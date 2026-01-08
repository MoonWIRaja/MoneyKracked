import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GITHUB_CLIENT_ID, BETTER_AUTH_URL } from '$env/static/private';

/**
 * Custom endpoint to initiate GitHub OAuth login.
 * This will first get GitHub user info, then check if account is linked.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  // Get callback URL from query params
  const callbackURL = url.searchParams.get('callbackURL') || '/dashboard';
  
  // Generate a unique state for CSRF protection
  const state = crypto.randomUUID();
  
  // Get if we're using secure cookies
  const isSecure = BETTER_AUTH_URL?.startsWith('https');
  
  // Store state in a cookie for verification later
  cookies.set('github_login_state', state, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });
  
  // Store callback URL
  cookies.set('github_login_callback', callbackURL, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  // Build GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', `${BETTER_AUTH_URL}/api/custom-auth/github/callback`);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', state);
  
  // Redirect to GitHub
  throw redirect(303, githubAuthUrl.toString());
};
