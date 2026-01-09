import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable, session as sessionTable } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import type { RequestHandler } from './$types';

// Get user ID helper
async function getUserId(request: Request, cookies: any): Promise<string | null> {
  const { auth } = await import('$lib/server/auth');
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user?.id) return session.user.id;

  const customToken = cookies.get('better-auth.session_token');
  if (customToken) {
    const dbSession = await db.query.session.findFirst({
      where: and(
        eq(sessionTable.token, customToken),
        gt(sessionTable.expiresAt, new Date())
      )
    });
    if (dbSession) return dbSession.userId;
  }
  return null;
}

// Generate backup codes
function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
    codes.push(code);
  }
  return codes;
}

/**
 * GET /api/2fa
 * Get 2FA status for current user
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: {
        twoFactorEnabled: true,
        email: true,
        name: true
      }
    });

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    return json({
      enabled: user.twoFactorEnabled || false,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    console.error('[2FA GET] Error:', error);
    return json({ error: 'Failed to get 2FA status' }, { status: 500 });
  }
};

/**
 * POST /api/2fa/setup
 * Generate QR code for 2FA setup
 * Body: { }
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId)
    });

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already enabled
    if (user.twoFactorEnabled) {
      return json({ error: '2FA is already enabled' }, { status: 400 });
    }

    // Generate new TOTP secret
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'MoneyKracked',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret
    });

    // Get the base32 secret
    const base32Secret = secret.base32;

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(totp.toString());

    // Store secret temporarily (not enabled yet)
    await db
      .update(userTable)
      .set({ twoFactorSecret: base32Secret })
      .where(eq(userTable.id, userId));

    return json({
      qrCode: qrCodeUrl,
      secret: secret.base32,
      message: 'Scan the QR code with your authenticator app'
    });
  } catch (error) {
    console.error('[2FA Setup] Error:', error);
    return json({ error: 'Failed to setup 2FA' }, { status: 500 });
  }
};

/**
 * PUT /api/2fa/enable
 * Enable 2FA after verifying the code
 * Body: { code: string }
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      console.error('[2FA Enable] Unauthorized - no user ID found');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    console.log('[2FA Enable] Request from user:', userId, 'Code:', code);

    if (!code || typeof code !== 'string') {
      console.error('[2FA Enable] Invalid code format:', code);
      return json({ error: 'Verification code is required' }, { status: 400 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId)
    });

    if (!user) {
      console.error('[2FA Enable] User not found:', userId);
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twoFactorSecret) {
      console.error('[2FA Enable] No 2FA secret found for user. Please scan QR code first.');
      return json({ error: '2FA not set up. Please scan QR code first.' }, { status: 400 });
    }

    if (user.twoFactorEnabled) {
      console.error('[2FA Enable] 2FA already enabled for user');
      return json({ error: '2FA is already enabled' }, { status: 400 });
    }

    console.log('[2FA Enable] Verifying TOTP code with secret:', user.twoFactorSecret);

    // Verify the code - use fromBase32 to properly load the secret
    const secret = Secret.fromBase32(user.twoFactorSecret);
    const totp = new TOTP({
      issuer: 'MoneyKracked',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret
    });

    // Allow 1 time step window (30 seconds before/after) for clock drift
    const delta = totp.validate({ token: code, window: 1 });

    console.log('[2FA Enable] TOTP validation result:', delta);

    if (delta === null) {
      console.error('[2FA Enable] Invalid code. Received:', code, 'Secret:', user.twoFactorSecret);
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Enable 2FA
    await db
      .update(userTable)
      .set({
        twoFactorEnabled: true,
        twoFactorBackupCodes: backupCodes
      })
      .where(eq(userTable.id, userId));

    console.log('[2FA Enable] Successfully enabled 2FA for user:', userId);

    return json({
      success: true,
      backupCodes,
      message: '2FA enabled successfully. Save your backup codes!'
    });
  } catch (error) {
    console.error('[2FA Enable] Error:', error);
    return json({ error: 'Failed to enable 2FA' }, { status: 500 });
  }
};

/**
 * DELETE /api/2fa/disable
 * Disable 2FA (requires current password or backup code)
 * Body: { password?: string, backupCode?: string }
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { backupCode, totpCode } = body;

    if (!backupCode && !totpCode) {
      return json({
        error: 'Either backup code or authenticator code is required to disable 2FA'
      }, { status: 400 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId)
    });

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return json({ error: '2FA is not enabled' }, { status: 400 });
    }

    let validCode = false;

    // Check backup code first
    if (backupCode && user.twoFactorBackupCodes) {
      const codes = user.twoFactorBackupCodes as string[];
      const codeIndex = codes.findIndex(c => c.replace(/\s/g, '') === backupCode.replace(/\s/g, ''));
      if (codeIndex !== -1) {
        validCode = true;
        // Remove used backup code
        const updatedCodes = codes.filter((_, i) => i !== codeIndex);
        await db
          .update(userTable)
          .set({ twoFactorBackupCodes: updatedCodes })
          .where(eq(userTable.id, userId));
      }
    }

    // Check TOTP code if backup didn't work
    if (!validCode && totpCode && user.twoFactorSecret) {
      const secret = Secret.fromBase32(user.twoFactorSecret);
      const totp = new TOTP({
        issuer: 'MoneyKracked',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret
      });

      const delta = totp.validate({ token: totpCode, window: 1 });
      if (delta !== null) {
        validCode = true;
      }
    }

    if (!validCode) {
      return json({ error: 'Invalid code' }, { status: 400 });
    }

    // Disable 2FA
    await db
      .update(userTable)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null
      })
      .where(eq(userTable.id, userId));

    return json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('[2FA Disable] Error:', error);
    return json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
};
