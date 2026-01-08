import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account, user, session } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } from '$env/static/private';

/**
 * Unified callback for GitHub OAuth.
 * Handles both login and account linking based on stored mode cookie.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // Get stored values from cookies
  const storedState = cookies.get('github_oauth_state');
  const mode = cookies.get('github_oauth_mode') || 'login';
  const callbackURL = cookies.get('github_oauth_callback') || '/dashboard';
  const linkUserId = cookies.get('github_oauth_user'); // Only set for link mode
  
  const isSecure = BETTER_AUTH_URL?.startsWith('https');
  
  // Clear all OAuth cookies
  cookies.delete('github_oauth_state', { path: '/' });
  cookies.delete('github_oauth_mode', { path: '/' });
  cookies.delete('github_oauth_callback', { path: '/' });
  cookies.delete('github_oauth_user', { path: '/' });
  
  // Validate state
  if (!code || !state || state !== storedState) {
    console.error('GitHub OAuth callback validation failed', { 
      hasCode: !!code, 
      hasState: !!state, 
      stateMatch: state === storedState,
      mode
    });
    const errorURL = mode === 'link' ? `${callbackURL}?error=link_failed&message=State+mismatch` : '/login?error=state_mismatch';
    throw redirect(303, errorURL);
  }
  
  try {
    // 1. Exchange code for token
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
        redirect_uri: `${BETTER_AUTH_URL}/api/github-oauth/callback`
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('GitHub token exchange failed:', tokenData);
      const errorURL = mode === 'link' ? `${callbackURL}?error=link_failed&message=Token+exchange+failed` : '/login?error=oauth_failed';
      throw redirect(303, errorURL);
    }
    
    const accessToken = tokenData.access_token;
    
    // 2. Get GitHub user info
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
      const errorURL = mode === 'link' ? `${callbackURL}?error=link_failed&message=Could+not+get+GitHub+info` : '/login?error=oauth_failed';
      throw redirect(303, errorURL);
    }
    
    console.log(`GitHub user info retrieved: ${githubUser.login} (ID: ${githubUser.id})`);
    
    // 3. Handle based on mode
    if (mode === 'link') {
      // LINK MODE: Link GitHub to existing user
      if (!linkUserId) {
        throw redirect(303, `${callbackURL}?error=link_failed&message=User+not+found`);
      }
      
      // Check if this GitHub is already linked
      const existingAccount = await db.query.account.findFirst({
        where: and(
          eq(account.providerId, 'github'),
          eq(account.accountId, String(githubUser.id))
        )
      });
      
      if (existingAccount) {
        if (existingAccount.userId === linkUserId) {
          throw redirect(303, `${callbackURL}?success=already_linked`);
        } else {
          throw redirect(303, `${callbackURL}?error=link_failed&message=GitHub+account+already+linked+to+another+user`);
        }
      }
      
      // Create new account link
      await db.insert(account).values({
        id: crypto.randomUUID(),
        userId: linkUserId,
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
      
      console.log(`Successfully linked GitHub account ${githubUser.login} to user ${linkUserId}`);
      throw redirect(303, `${callbackURL}?success=linked`);
      
    } else {
      // LOGIN MODE: Check if GitHub is linked and login
      const linkedAccount = await db.query.account.findFirst({
        where: and(
          eq(account.providerId, 'github'),
          eq(account.accountId, String(githubUser.id))
        )
      });
      
      if (!linkedAccount) {
        console.log(`GitHub account ${githubUser.login} is not linked to any user`);
        throw redirect(303, '/login?error=not_linked');
      }
      
      // Get the linked user
      const linkedUser = await db.query.user.findFirst({
        where: eq(user.id, linkedAccount.userId)
      });
      
      if (!linkedUser) {
        console.error('Linked user not found:', linkedAccount.userId);
        throw redirect(303, '/login?error=oauth_failed');
      }
      
      // Create session
      const sessionToken = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await db.insert(session).values({
        id: sessionId,
        userId: linkedUser.id,
        token: sessionToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null
      });
      
      // Set session cookie - MUST match Better Auth's cookie name
      cookies.set('better-auth.session_token', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      
      // Update linked account with new token
      await db.update(account)
        .set({
          accessToken: accessToken,
          updatedAt: new Date()
        })
        .where(eq(account.id, linkedAccount.id));
      
      console.log(`GitHub login successful for ${linkedUser.email}`);
      throw redirect(303, callbackURL);
    }
    
  } catch (err: any) {
    if (err.status === 303) throw err;
    
    console.error('GitHub OAuth error:', err);
    const errorURL = mode === 'link' ? `${callbackURL}?error=link_failed&message=${encodeURIComponent(err.message || 'Unknown error')}` : '/login?error=oauth_failed';
    throw redirect(303, errorURL);
  }
};
