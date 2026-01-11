import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

/**
 * API endpoint to check if current user has GitHub linked.
 * Used by Settings page to always get fresh data.
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
  try {
    // Get session
    const session = await auth.api.getSession({
      headers: request.headers
    });

    // Fallback: check custom session cookie
    let userId = session?.user?.id;

    if (!userId) {
      // Check mk_session cookie first (our custom session)
      let customToken = cookies.get('mk_session');
      if (!customToken) {
        customToken = cookies.get('better-auth.session_token');
      }
      if (customToken) {
        const { queryClient } = await import('$lib/server/db');
        // Extract session token (before the dot if signed)
        const sessionToken = customToken.includes('.') ? customToken.split('.')[0] : customToken;

        const result = await queryClient.unsafe(
          'SELECT s.user_id FROM session s WHERE s.token = $1 AND (s.expires_at IS NULL OR s.expires_at > NOW()) LIMIT 1',
          [sessionToken]
        );

        if (result && result.length > 0) {
          userId = (result[0] as any).user_id;
        }
      }
    }

    if (!userId) {
      return json({ linked: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Check if GitHub is linked
    const linkedAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, userId),
        eq(account.providerId, 'github')
      )
    });

    return json({
      linked: !!linkedAccount,
      accountId: linkedAccount?.accountId || null
    });

  } catch (err: any) {
    console.error('Error checking GitHub status:', err);
    return json({ linked: false, error: err.message }, { status: 500 });
  }
};
