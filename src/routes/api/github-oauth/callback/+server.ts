import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account, user, session as sessionTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL, BETTER_AUTH_SECRET } from '$env/static/private';
import { auth } from '$lib/server/auth';

/**
 * Unified callback for GitHub OAuth.
 * Handles both login and account linking based on stored mode cookie.
 */
export const GET: RequestHandler = async ({ url, cookies, request }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // DEBUG: Log incoming request details
  console.log('=== GitHub OAuth Callback DEBUG ===');
  console.log('url.origin:', url.origin);
  console.log('url.hostname:', url.hostname);
  console.log('url.href:', url.href);
  console.log('Request Host header:', request.headers.get('host'));
  console.log('Request Origin header:', request.headers.get('origin'));
  console.log('Request x-forwarded-host:', request.headers.get('x-forwarded-host'));
  console.log('Request x-forwarded-proto:', request.headers.get('x-forwarded-proto'));
  console.log('===================================');

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
  if (!state || state !== storedState) {
    console.error('GitHub OAuth state mismatch');
    throw redirect(303, `${callbackURL}?error=invalid_state`);
  }

  if (!code) {
    console.error('GitHub OAuth: No code provided');
    throw redirect(303, `${callbackURL}?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error);
      throw redirect(303, `${callbackURL}?error=oauth_failed`);
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'MoneyKracked'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const githubUser = await userResponse.json();

    // Get user email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'MoneyKracked'
      }
    });

    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email;

    if (mode === 'link') {
      // ===== ACCOUNT LINKING MODE =====
      if (!linkUserId) {
        throw redirect(303, `${callbackURL}?error=link_failed`);
      }

      // Check if GitHub account is already linked to another user
      const existingAccount = await db.query.account.findFirst({
        where: eq(account.accountId, String(githubUser.id))
      });

      if (existingAccount && existingAccount.userId !== linkUserId) {
        throw redirect(303, `${callbackURL}?error=account_already_linked`);
      }

      // Check if user already has a GitHub-linked account
      const userExistingAccount = await db.query.account.findFirst({
        where: and(
          eq(account.userId, linkUserId),
          eq(account.providerId, 'github')
        )
      });

      if (userExistingAccount) {
        throw redirect(303, `${callbackURL}?error=already_linked`);
      }

      // Create new GitHub account linked to current user
      const accountId = crypto.randomUUID();
      await db.insert(account).values({
        id: accountId,
        userId: linkUserId,
        accountId: String(githubUser.id),
        providerId: 'github',
        accessToken
      });

      console.log(`GitHub account linked for user: ${linkUserId}`);
      throw redirect(303, `${callbackURL}?success=linked`);

    } else {
      // ===== LOGIN MODE =====
      // Check if GitHub account exists
      const existingAccount = await db.query.account.findFirst({
        where: eq(account.accountId, String(githubUser.id))
      });

      if (existingAccount) {
        // User exists - create session
        const linkedUser = await db.query.user.findFirst({
          where: eq(user.id, existingAccount.userId)
        });

        if (!linkedUser) {
          console.error('Linked user not found:', existingAccount.userId);
          throw redirect(303, '/login?error=oauth_failed');
        }

        // Create session
        const sessionToken = crypto.randomUUID();
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db.insert(sessionTable).values({
          id: sessionId,
          userId: linkedUser.id,
          token: sessionToken,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null
        });

        // Sign the cookie value like Better Auth does
        // Better Auth uses format: token.signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(BETTER_AUTH_SECRET),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(sessionToken)
        );
        // Convert to base64url (no padding)
        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const signedToken = `${sessionToken}.${signatureBase64}`;

        // Get the actual origin from request for cookie domain
        const requestOrigin = url.origin; // e.g., "https://test2.owlscottage.com"
        const authUrl = new URL(BETTER_AUTH_URL);
        const authDomain = authUrl.hostname;

        console.log(`[GitHub OAuth] Session created: ${sessionToken.substring(0, 8)}...`);
        console.log(`[GitHub OAuth] Request origin: ${requestOrigin}`);
        console.log(`[GitHub OAuth] Auth domain from env: ${authDomain}`);
        console.log(`[GitHub OAuth] Signed token: ${signedToken.substring(0, 50)}...`);
        console.log(`GitHub login successful for ${linkedUser.email}`);

        // Update linked account with new token
        await db.update(account)
          .set({
            accessToken: accessToken,
            updatedAt: new Date()
          })
          .where(eq(account.id, existingAccount.id));

        // WORKAROUND: Redirect to client-side page that will set cookie via fetch
        // This avoids the cookie-on-redirect issue
        console.log(`[GitHub OAuth] Redirecting to auth callback page with token...`);

        // Encode token for URL
        const encodedToken = encodeURIComponent(signedToken);

        // Redirect to auth callback page with token in URL
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `/auth/callback?token=${encodedToken}`
          }
        });
      }

      // New user - GitHub account not linked to any existing user
      // Redirect to login with clear error message
      throw redirect(303, '/login?error=github_not_linked');
    }

  } catch (err: any) {
    // Re-throw SvelteKit redirects
    if (err.status === 303) throw err;

    console.error('GitHub OAuth error:', err);
    const errorURL = mode === 'link' ? `${callbackURL}?error=link_failed&message=${encodeURIComponent(err.message || 'Unknown error')}` : '/login?error=oauth_failed';
    throw redirect(303, errorURL);
  }
};
