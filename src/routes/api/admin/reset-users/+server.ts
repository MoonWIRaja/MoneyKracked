import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user, account, session, aiChatHistory, aiSessionSummaries, aiUserProfiles, aiInsights, aiMemories } from '$lib/server/db/schema';
import { BETTER_AUTH_SECRET } from '$env/static/private';

/**
 * DANGEROUS: This endpoint resets all users
 * Protected by secret key in query param
 * 
 * Usage: GET /api/admin/reset-users?key=YOUR_SECRET
 */
export const GET: RequestHandler = async ({ url }) => {
  const key = url.searchParams.get('key');
  
  // Simple protection - use BETTER_AUTH_SECRET as admin key
  if (key !== BETTER_AUTH_SECRET) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Admin] Starting user reset...');

    // Delete in order to avoid foreign key issues
    await db.delete(session);
    console.log('[Admin] Deleted all sessions');

    await db.delete(aiChatHistory);
    console.log('[Admin] Deleted all chat history');

    await db.delete(aiSessionSummaries);
    console.log('[Admin] Deleted all session summaries');

    await db.delete(aiUserProfiles);
    console.log('[Admin] Deleted all user profiles');

    await db.delete(aiInsights);
    console.log('[Admin] Deleted all insights');

    await db.delete(aiMemories);
    console.log('[Admin] Deleted all memories');

    await db.delete(account);
    console.log('[Admin] Deleted all accounts');

    await db.delete(user);
    console.log('[Admin] Deleted all users');

    return json({ 
      success: true, 
      message: 'All users and related data have been reset. You can now register again.' 
    });

  } catch (err: any) {
    console.error('[Admin] Reset failed:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
