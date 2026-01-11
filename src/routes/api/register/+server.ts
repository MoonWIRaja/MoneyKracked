import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user, verification, account } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '$lib/server/email';
import { randomBytes, randomUUID } from 'crypto';

// Import Better Auth's internal password hashing
// @ts-ignore - Accessing internal Better Auth API
import { hashPassword } from 'better-auth/crypto';

/**
 * Custom Register Endpoint
 * Handles user registration and sends verification email
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password, name, username } = body;

    // Validate input
    if (!email || !password || !name || !username) {
      return json({
        success: false,
        error: 'All fields are required'
      }, { status: 400 });
    }

    if (password.length < 8) {
      return json({
        success: false,
        error: 'Password must be at least 8 characters'
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase())
    });

    if (existingUser) {
      return json({
        success: false,
        error: 'Email already registered'
      }, { status: 400 });
    }

    const existingUsername = await db.query.user.findFirst({
      where: eq(user.username, username)
    });

    if (existingUsername) {
      return json({
        success: false,
        error: 'Username already taken'
      }, { status: 400 });
    }

    // Hash password using Better Auth's hash function
    const hashedPassword = await hashPassword(password);

    const userId = randomUUID();

    // Create user
    await db.insert(user).values({
      id: userId,
      email: email.toLowerCase(),
      name,
      username,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('[Register] User created:', email);

    // Create account record for Better Auth (required for sign in)
    const accountId = randomUUID();
    await db.insert(account).values({
      id: accountId,
      userId: userId,
      accountId: email.toLowerCase(), // For email auth, accountId = email
      providerId: 'credential', // Email/password provider
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('[Register] Account record created for:', email);

    // Create verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(verification).values({
      id: randomUUID(),
      identifier: email.toLowerCase(),
      value: token,
      expiresAt
    });

    console.log('[Register] Verification token created for:', email);

    // Send verification email
    const verificationUrl = `https://test2.owlscottage.com/verify-email?token=${token}`;
    console.log('[Register] Sending verification email to:', email);
    console.log('[Register] Verification URL:', verificationUrl);

    const emailSent = await sendVerificationEmail(email, name, verificationUrl);

    if (!emailSent) {
      console.error('[Register] Failed to send verification email to:', email);
      return json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      }, { status: 500 });
    }

    console.log('[Register] Verification email sent successfully to:', email);

    return json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      emailSent: true,
      user: { email, name }
    });

  } catch (err: any) {
    console.error('[Register] Error:', err);
    return json({
      success: false,
      error: err.message || 'Registration failed'
    }, { status: 500 });
  }
};
