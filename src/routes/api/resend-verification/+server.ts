import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, verification } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '$lib/server/email';

/**
 * POST /api/resend-verification
 * Resend verification email to user
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

    if (!existingUser) {
      // Don't reveal whether user exists
      return json({
        success: true,
        message: 'If the email exists, a verification link has been sent.'
      });
    }

    // Check if email is already verified
    if (existingUser.emailVerified) {
      return json({
        success: true,
        message: 'Email is already verified. You can now login.'
      });
    }

    // Generate verification token using crypto
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store verification token in database
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: existingUser.email,
      value: token,
      expiresAt: expiresAt
    }).onConflictDoNothing();

    // Create verification URL
    const verificationUrl = `https://test2.owlscottage.com/verify-email?token=${token}`;

    // Send verification email directly with our email service
    const emailSent = await sendVerificationEmail(
      existingUser.email,
      existingUser.name || 'User',
      token
    );

    if (!emailSent) {
      return json({ error: 'Failed to send verification email. Please try again later.' }, { status: 500 });
    }

    console.log('[Resend Verification] Verification email sent to:', existingUser.email);

    return json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });
  } catch (error: any) {
    console.error('[Resend Verification] Error:', error);
    return json({ error: error.message || 'Failed to resend verification email' }, { status: 500 });
  }
};
