import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Set session cookie from client-side request
 * This is a workaround for OAuth callback cookie issues
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const { token } = await request.json();

    if (!token) {
      return json({ error: 'No token provided' }, { status: 400 });
    }

    console.log('[Set-Session API] Setting session token:', token.substring(0, 20) + '...');

    // Set cookie with proper attributes
    // Try WITHOUT Domain attribute - let browser decide
    cookies.set('better-auth.session_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'none', // Try 'none' for cross-origin
      secure: true, // Use true for HTTPS
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    console.log('[Set-Session API] Cookie set successfully');

    return json({ success: true });
  } catch (err) {
    console.error('[Set-Session API] Error:', err);
    return json({ error: 'Failed to set session' }, { status: 500 });
  }
};
