import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { GITHUB_CLIENT_ID, BETTER_AUTH_URL } from '$env/static/private';

/**
 * Custom endpoint to initiate GitHub OAuth linking.
 * This bypasses the Better Auth client library issues.
 */
export const GET: RequestHandler = async ({ request, url, cookies }) => {
  // 1. Check if user is logged in by getting session
  const session = await auth.api.getSession({
    headers: request.headers
  });
  
  if (!session || !session.user) {
    throw redirect(303, '/login?error=not_logged_in');
  }
  
  // 2. Get callback URL from query params
  const callbackURL = url.searchParams.get('callbackURL') || '/settings';
  
  // 3. Generate a unique state for CSRF protection
  const state = crypto.randomUUID();
  
  // 4. Store state in a cookie for verification later
  cookies.set('github_link_state', state, {
    path: '/',
    httpOnly: true,
    secure: BETTER_AUTH_URL?.startsWith('https'),
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });
  
  // 5. Store user ID in cookie so we know who to link
  cookies.set('github_link_user', session.user.id, {
    path: '/',
    httpOnly: true,
    secure: BETTER_AUTH_URL?.startsWith('https'),
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  // 6. Store callback URL
  cookies.set('github_link_callback', callbackURL, {
    path: '/',
    httpOnly: true,
    secure: BETTER_AUTH_URL?.startsWith('https'),
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  // 7. Build GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', `${BETTER_AUTH_URL}/api/custom-link/github/callback`);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', state);
  
  // 8. Redirect to GitHub
  throw redirect(303, githubAuthUrl.toString());
};
