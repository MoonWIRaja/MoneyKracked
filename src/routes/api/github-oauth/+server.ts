import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GITHUB_CLIENT_ID, BETTER_AUTH_URL } from '$env/static/private';

/**
 * Unified GitHub OAuth initiation endpoint.
 * Handles both login and account linking via "mode" query parameter.
 * 
 * Usage:
 * - Login: /api/github-oauth?mode=login&callbackURL=/dashboard
 * - Link: /api/github-oauth?mode=link&callbackURL=/settings
 */
export const GET: RequestHandler = async ({ url, cookies, request }) => {
  // Get mode (login or link) and callback URL
  const mode = url.searchParams.get('mode') || 'login';
  const callbackURL = url.searchParams.get('callbackURL') || '/dashboard';
  
  // For link mode, we need to verify user is logged in
  if (mode === 'link') {
    // Import auth dynamically to avoid circular dependency
    const { auth } = await import('$lib/server/auth');
    const session = await auth.api.getSession({
      headers: request.headers
    });
    
    if (!session || !session.user) {
      throw redirect(303, '/login?error=not_logged_in');
    }
    
    // Store user ID for link mode
    const isSecure = BETTER_AUTH_URL?.startsWith('https');
    cookies.set('github_oauth_user', session.user.id, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 10
    });
  }
  
  // Generate state for CSRF protection
  const state = crypto.randomUUID();
  const isSecure = BETTER_AUTH_URL?.startsWith('https');
  
  // Store state and mode in cookies
  cookies.set('github_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  cookies.set('github_oauth_mode', mode, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  cookies.set('github_oauth_callback', callbackURL, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  // Build GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  const redirectUri = `${BETTER_AUTH_URL}/api/github-oauth/callback`;
  
  console.log('=== GitHub OAuth Debug ===');
  console.log('BETTER_AUTH_URL:', BETTER_AUTH_URL);
  console.log('redirect_uri:', redirectUri);
  console.log('GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID);
  console.log('========================');
  
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', state);
  // Force GitHub to always show authorization screen (no auto-skip)
  githubAuthUrl.searchParams.set('prompt', 'consent');
  
  throw redirect(303, githubAuthUrl.toString());
};
