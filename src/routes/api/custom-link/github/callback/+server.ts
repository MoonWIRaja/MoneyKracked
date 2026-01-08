import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } from '$env/static/private';

/**
 * Callback endpoint for GitHub OAuth linking.
 * GitHub redirects here after user authorizes.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // 1. Verify state matches cookie
  const storedState = cookies.get('github_link_state');
  const userId = cookies.get('github_link_user');
  const callbackURL = cookies.get('github_link_callback') || '/settings';
  
  // Clear cookies
  cookies.delete('github_link_state', { path: '/' });
  cookies.delete('github_link_user', { path: '/' });
  cookies.delete('github_link_callback', { path: '/' });
  
  if (!code || !state || state !== storedState || !userId) {
    console.error('GitHub link callback validation failed', { 
      hasCode: !!code, 
      hasState: !!state, 
      stateMatch: state === storedState,
      hasUserId: !!userId 
    });
    throw redirect(303, `${callbackURL}?error=link_failed&message=Invalid+state`);
  }
  
  try {
    // 2. Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${BETTER_AUTH_URL}/api/custom-link/github/callback`
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('GitHub token exchange failed:', tokenData);
      throw redirect(303, `${callbackURL}?error=link_failed&message=Token+exchange+failed`);
    }
    
    const accessToken = tokenData.access_token;
    
    // 3. Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'MoneyKracked-App'
      }
    });
    
    const githubUser = await userResponse.json();
    
    if (!githubUser.id) {
      console.error('Failed to get GitHub user info:', githubUser);
      throw redirect(303, `${callbackURL}?error=link_failed&message=Could+not+get+GitHub+info`);
    }
    
    // 4. Check if this GitHub account is already linked to another user
    const existingAccount = await db.query.account.findFirst({
      where: (acc, { and, eq }) => and(
        eq(acc.providerId, 'github'),
        eq(acc.accountId, String(githubUser.id))
      )
    });
    
    if (existingAccount) {
      if (existingAccount.userId === userId) {
        // Already linked to this user
        throw redirect(303, `${callbackURL}?success=already_linked`);
      } else {
        // Linked to different user
        throw redirect(303, `${callbackURL}?error=link_failed&message=GitHub+account+already+linked+to+another+user`);
      }
    }
    
    // 5. Create new account link
    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: userId,
      providerId: 'github',
      accountId: String(githubUser.id),
      accessToken: accessToken,
      refreshToken: tokenData.refresh_token || null,
      accessTokenExpiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000) 
        : null,
      refreshTokenExpiresAt: tokenData.refresh_token_expires_in
        ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000)
        : null,
      scope: tokenData.scope || null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`Successfully linked GitHub account ${githubUser.login} to user ${userId}`);
    
    // 6. Redirect back with success
    throw redirect(303, `${callbackURL}?success=linked`);
    
  } catch (err: any) {
    // If it's already a redirect, rethrow
    if (err.status === 303) throw err;
    
    console.error('GitHub link error:', err);
    throw redirect(303, `${callbackURL}?error=link_failed&message=${encodeURIComponent(err.message || 'Unknown error')}`);
  }
};
