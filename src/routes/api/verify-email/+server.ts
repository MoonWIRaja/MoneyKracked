import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { verification, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/verify-email
 * Verify email with token
 *
 * This endpoint handles email verification manually without relying on Better Auth's API.
 * Better Auth's verifyEmail API has issues with the request format, so we do direct DB operations.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return json({ error: 'Verification token is required' }, { status: 400 });
    }

    console.log('[Verify Email] Attempting to verify email with token');

    // Find the verification record
    const verificationRecord = await db.query.verification.findFirst({
      where: eq(verification.value, token)
    });

    if (!verificationRecord) {
      console.log('[Verify Email] Token not found in database');
      return json({ error: 'Invalid or expired verification link' }, { status: 400 });
    }

    // Check if expired
    if (new Date(verificationRecord.expiresAt) < new Date()) {
      console.log('[Verify Email] Token has expired');
      return json({ error: 'Verification link has expired. Please request a new one.' }, { status: 400 });
    }

    // Find user by email (identifier)
    const userRecord = await db.query.user.findFirst({
      where: eq(user.email, verificationRecord.identifier)
    });

    if (!userRecord) {
      console.log('[Verify Email] User not found for identifier:', verificationRecord.identifier);
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already verified
    if (userRecord.emailVerified) {
      console.log('[Verify Email] Email already verified for:', userRecord.email);
      // Delete the used token
      await db.delete(verification)
        .where(eq(verification.value, token));
      return json({
        success: true,
        message: 'Email is already verified!'
      });
    }

    // Mark email as verified
    await db.update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, userRecord.id));

    // Delete the verification record
    await db.delete(verification)
      .where(eq(verification.value, token));

    console.log('[Verify Email] Verification successful for:', userRecord.email);

    return json({
      success: true,
      message: 'Email verified successfully! You can now login.'
    });
  } catch (error: any) {
    console.error('[Verify Email] Error:', error);
    return json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
};
