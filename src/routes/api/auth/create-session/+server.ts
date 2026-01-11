import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Create session from token and return proper session
 * This uses Better Auth's API to validate and create session
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'No token provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Create-Session] Creating session with token:', token.substring(0, 20) + '...');

    // Set cookie using SvelteKit's cookies API with minimal attributes
    cookies.set('better-auth.session_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // Critical: proxy terminates SSL
      maxAge: 60 * 60 * 24 * 7
    });

    console.log('[Create-Session] Cookie set, returning success');

    // Return JSON with redirect URL
    return new Response(JSON.stringify({ success: true, redirect: '/dashboard' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Create-Session] Error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
