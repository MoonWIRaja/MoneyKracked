import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user, verification } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '$lib/server/email';
import { randomBytes, randomUUID } from 'crypto';

/**
 * Resend Verification Email Endpoint
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return json({
        success: false,
        error: 'Email is required'
      }, { status: 400 });
    }

    // Find user
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase())
    });

    if (!existingUser) {
      return json({
        success: false,
        error: 'No account found with this email'
      }, { status: 404 });
    }

    if (existingUser.emailVerified) {
      return json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 });
    }

    // Delete old verification tokens
    await db.delete(verification)
      .where(eq(verification.identifier, email.toLowerCase()));

    // Create new verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(verification).values({
      id: randomUUID(),
      identifier: email.toLowerCase(),
      value: token,
      expiresAt
    });

    console.log('[Resend] Verification token created for:', email);

    // Send verification email
    const verificationUrl = `https://test2.owlscottage.com/verify-email?token=${token}`;
    const emailSent = await sendVerificationEmail(email, existingUser.name || 'User', verificationUrl);

    if (!emailSent) {
      console.error('[Resend] Failed to send verification email to:', email);
      return json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      }, { status: 500 });
    }

    console.log('[Resend] Verification email sent successfully to:', email);

    return json({
      success: true,
      message: 'Verification email sent successfully!'
    });

  } catch (err: any) {
    console.error('[Resend] Error:', err);
    return json({
      success: false,
      error: err.message || 'Failed to resend email'
    }, { status: 500 });
  }
};
