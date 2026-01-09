import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable, session as sessionTable } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { Secret, TOTP } from 'otpauth';
import type { RequestHandler } from './$types';

/**
 * POST /api/2fa/verify
 * Verify 2FA code during login or for validation
 * Body: { userId: string, code: string, backupCode?: boolean }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, code, isBackup = false } = body;

    if (!userId || !code) {
      return json({ error: 'User ID and code are required' }, { status: 400 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId)
    });

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return json({ error: '2FA is not enabled for this account' }, { status: 400 });
    }

    let validCode = false;
    let usedBackupIndex = -1;

    // Check backup code first if requested
    if (isBackup && user.twoFactorBackupCodes) {
      const codes = user.twoFactorBackupCodes as string[];
      const cleanCode = code.replace(/\s/g, '').toUpperCase();
      usedBackupIndex = codes.findIndex(c => c.replace(/\s/g, '') === cleanCode);

      if (usedBackupIndex !== -1) {
        validCode = true;
        // Remove used backup code
        const updatedCodes = codes.filter((_, i) => i !== usedBackupIndex);
        await db
          .update(userTable)
          .set({ twoFactorBackupCodes: updatedCodes.length > 0 ? updatedCodes : null })
          .where(eq(userTable.id, userId));
      }
    }

    // Check TOTP code if backup didn't work or not requested
    if (!validCode && user.twoFactorSecret) {
      const secret = Secret.fromBase32(user.twoFactorSecret);
      const totp = new TOTP({
        issuer: 'MoneyKracked',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret
      });

      // Allow 1 time step window (30 seconds before/after)
      const delta = totp.validate({ token: code, window: 1 });
      if (delta !== null) {
        validCode = true;
      }
    }

    if (!validCode) {
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }

    return json({
      success: true,
      usedBackup: usedBackupIndex !== -1,
      remainingBackups: user.twoFactorBackupCodes
        ? (usedBackupIndex !== -1
          ? (user.twoFactorBackupCodes as string[]).length - 1
          : (user.twoFactorBackupCodes as string[]).length)
        : 0
    });
  } catch (error) {
    console.error('[2FA Verify] Error:', error);
    return json({ error: 'Failed to verify code' }, { status: 500 });
  }
};
