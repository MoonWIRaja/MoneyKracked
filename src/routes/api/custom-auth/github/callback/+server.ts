import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account, user, session } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL, BETTER_AUTH_SECRET } from '$env/static/private';

/**
 * Callback endpoint for GitHub OAuth login.
 * GitHub redirects here after user authorizes.
 * We check if GitHub account is linked, if yes - login, if no - error.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // Verify state matches cookie
  const storedState = cookies.get('github_login_state');
  const callbackURL = cookies.get('github_login_callback') || '/dashboard';
  
  // Get if we're using secure cookies
  const isSecure = BETTER_AUTH_URL?.startsWith('https');
  
  // Clear state cookies
  cookies.delete('github_login_state', { path: '/' });
  cookies.delete('github_login_callback', { path: '/' });
  
  if (!code || !state || state !== storedState) {
    console.error('GitHub login callback validation failed', { 
      hasCode: !!code, 
      hasState: !!state, 
      stateMatch: state === storedState
    });
    throw redirect(303, '/login?error=state_mismatch');
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
        redirect_uri: `${BETTER_AUTH_URL}/api/custom-auth/github/callback`
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('GitHub token exchange failed:', tokenData);
      throw redirect(303, '/login?error=oauth_failed');
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
      throw redirect(303, '/login?error=oauth_failed');
    }
    
    console.log(`GitHub user info retrieved: ${githubUser.login} (ID: ${githubUser.id})`);
    
    // 3. Check if this GitHub account is linked to any user
    const linkedAccount = await db.query.account.findFirst({
      where: and(
        eq(account.providerId, 'github'),
        eq(account.accountId, String(githubUser.id))
      )
    });
    
    if (!linkedAccount) {
      // GitHub account not linked to any user
      console.log(`GitHub account ${githubUser.login} is not linked to any user`);
      throw redirect(303, '/login?error=not_linked');
    }
    
    // 4. Get the user
    const linkedUser = await db.query.user.findFirst({
      where: eq(user.id, linkedAccount.userId)
    });
    
    if (!linkedUser) {
      console.error('Linked user not found:', linkedAccount.userId);
      throw redirect(303, '/login?error=oauth_failed');
    }
    
    // 5. Create session for this user
    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
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
    
    console.log(`Created session for user ${linkedUser.email}`);
    
    // 6. Set session cookie (matching Better Auth cookie format)
    cookies.set('moneykracked.session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    // Also update the linked account with new token
    await db.update(account)
      .set({
        accessToken: accessToken,
        updatedAt: new Date()
      })
      .where(eq(account.id, linkedAccount.id));
    
    // 7. Redirect to dashboard
    console.log(`GitHub login successful for ${linkedUser.email}, redirecting to ${callbackURL}`);
    throw redirect(303, callbackURL);
    
  } catch (err: any) {
    // If it's already a redirect, rethrow
    if (err.status === 303) throw err;
    
    console.error('GitHub login error:', err);
    throw redirect(303, '/login?error=oauth_failed');
  }
};
