import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, verification } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/reset-password
 * Reset user password with token
 *
 * Uses the same password hashing as Better Auth (scrypt with hex encoding)
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return json({ error: 'Token and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Find the verification record
    const verificationRecord = await db.query.verification.findFirst({
      where: eq(verification.value, token)
    });

    if (!verificationRecord) {
      return json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    // Check if expired
    if (new Date(verificationRecord.expiresAt) < new Date()) {
      return json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    // Extract email from identifier (remove _reset suffix if present)
    const identifier = verificationRecord.identifier;
    const email = identifier.endsWith('_reset') ? identifier.slice(0, -6) : identifier;

    // Find user by email
    const userRecord = await db.query.user.findFirst({
      where: eq(user.email, email)
    });

    if (!userRecord) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Hash the new password using the same method as Better Auth
    // Better Auth uses scrypt with hex encoding
    const { scryptAsync } = await import('@noble/hashes/scrypt.js');
    const { hex } = await import('@better-auth/utils/hex');

    // Generate random salt (16 bytes as hex)
    const saltArray = new Uint8Array(16);
    crypto.getRandomValues(saltArray);
    const salt = hex.encode(saltArray);

    // Generate the key using scrypt (same config as Better Auth)
    const key = await scryptAsync(newPassword.normalize('NFKC'), salt, {
      N: 16384,
      r: 16,
      p: 1,
      dkLen: 64,
      maxmem: 128 * 16384 * 16 * 2
    });

    // Format: salt:key (both hex encoded)
    const hashedPassword = `${salt}:${hex.encode(key)}`;

    // Update the password in the account table
    const { account } = await import('$lib/server/db/schema');

    // Find the credential account for this user
    const userAccounts = await db.query.account.findMany({
      where: eq(account.userId, userRecord.id)
    });

    const credentialAccount = userAccounts.find(acc => acc.providerId === 'credential');

    if (credentialAccount) {
      // Update existing account password
      await db.update(account)
        .set({ password: hashedPassword })
        .where(eq(account.id, credentialAccount.id));
    } else {
      // This shouldn't happen for email/password users
      return json({ error: 'Account not found' }, { status: 404 });
    }

    // Delete the verification record
    await db.delete(verification).where(eq(verification.value, token));

    console.log('[Reset Password] Password reset successful for:', email);

    return json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });
  } catch (error: any) {
    console.error('[Reset Password] Error:', error);
    return json({ error: error.message || 'Failed to reset password' }, { status: 500 });
  }
};
