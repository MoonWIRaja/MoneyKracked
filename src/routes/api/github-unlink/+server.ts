import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

/**
 * DELETE: Unlink GitHub account from current user.
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
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
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Find and delete the GitHub account link
    const linkedAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, userId),
        eq(account.providerId, 'github')
      )
    });

    if (!linkedAccount) {
      return json({ success: false, error: 'GitHub account not linked' }, { status: 404 });
    }

    // Delete the account link
    await db.delete(account)
      .where(eq(account.id, linkedAccount.id));

    console.log(`Successfully unlinked GitHub account from user ${userId}`);

    return json({
      success: true,
      message: 'GitHub account unlinked successfully'
    });

  } catch (err: any) {
    console.error('Error unlinking GitHub account:', err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
};
