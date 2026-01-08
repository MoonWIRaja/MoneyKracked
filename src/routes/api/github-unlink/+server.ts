import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account, session as sessionTable } from '$lib/server/db/schema';
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
      const customToken = cookies.get('better-auth.session_token');
      if (customToken) {
        const { gt } = await import('drizzle-orm');
        
        const dbSession = await db.query.session.findFirst({
          where: and(
            eq(sessionTable.token, customToken),
            gt(sessionTable.expiresAt, new Date())
          )
        });
        
        if (dbSession) {
          userId = dbSession.userId;
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
