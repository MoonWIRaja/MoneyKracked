import { json, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user, session as sessionTable, account, financialAccounts, categories, transactions, budgets, goals, aiChatHistory, healthSnapshots } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';

/**
 * DELETE /api/delete-account
 * Permanently delete user account and all associated data
 * Requires password verification
 */
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    // Get the session from the request
    const sessionData = await auth.api.getSession({
      headers: request.headers
    });

    if (!sessionData?.user) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return json({ error: 'Password is required to delete account' }, { status: 400 });
    }

    // Verify password by attempting to sign in
    const email = sessionData.user.email;
    if (!email) {
      return json({ error: 'User email not found' }, { status: 400 });
    }

    try {
      // Verify password using Better Auth
      await auth.api.signInEmail({
        body: {
          email,
          password
        }
      });
    } catch (err) {
      if (err instanceof APIError) {
        console.log('[Delete Account] Password verification failed:', err.message);
        return json({ error: 'Incorrect password' }, { status: 401 });
      }
      throw err;
    }

    console.log('[Delete Account] Password verified, proceeding to delete account:', userId);

    // Delete in proper order to respect foreign key constraints
    // 1. Delete AI chat history
    await db.delete(aiChatHistory).where(eq(aiChatHistory.userId, userId));

    // 2. Delete health snapshots
    await db.delete(healthSnapshots).where(eq(healthSnapshots.userId, userId));

    // 3. Delete transactions
    await db.delete(transactions).where(eq(transactions.userId, userId));

    // 4. Delete budgets
    await db.delete(budgets).where(eq(budgets.userId, userId));

    // 5. Delete goals
    await db.delete(goals).where(eq(goals.userId, userId));

    // 6. Delete categories
    await db.delete(categories).where(eq(categories.userId, userId));

    // 7. Delete financial accounts
    await db.delete(financialAccounts).where(eq(financialAccounts.userId, userId));

    // 8. Delete OAuth accounts
    await db.delete(account).where(eq(account.userId, userId));

    // 9. Delete sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // 10. Finally, delete the user
    await db.delete(user).where(eq(user.id, userId));

    console.log('[Delete Account] Account deleted successfully:', userId);

    return json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error: any) {
    console.error('[Delete Account] Error:', error);
    return json({ error: error.message || 'Failed to delete account' }, { status: 500 });
  }
};
