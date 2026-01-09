import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendPasswordResetEmail } from '$lib/server/email';

/**
 * POST /api/forgot-password
 * Send password reset email to user
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase())
    });

    // Always return success to prevent email enumeration
    // But only actually send email if user exists
    if (!existingUser) {
      console.log('[Forgot Password] User not found, but returning success for security');
      return json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token using crypto
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token in verification table
    // We reuse the verification table with identifier = email and value = reset token
    const { verification } = await import('$lib/server/db/schema');
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: `${email}_reset`, // Add _reset suffix to distinguish from email verification
      value: token,
      expiresAt: expiresAt
    }).onConflictDoNothing();

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      existingUser.email,
      existingUser.name || 'User',
      token
    );

    if (!emailSent) {
      return json({ error: 'Failed to send reset email. Please try again later.' }, { status: 500 });
    }

    console.log('[Forgot Password] Reset email sent to:', existingUser.email);

    return json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    console.error('[Forgot Password] Error:', error);
    return json({ error: error.message || 'Failed to send reset email' }, { status: 500 });
  }
};
