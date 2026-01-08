import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// Get user ID helper
async function getUserId(request: Request, cookies: any): Promise<string | null> {
  const { auth } = await import('$lib/server/auth');
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user?.id) return session.user.id;
  
  const customToken = cookies.get('better-auth.session_token');
  if (customToken) {
    const { session: sessionTable } = await import('$lib/server/db/schema');
    const { gt } = await import('drizzle-orm');
    const dbSession = await db.query.session.findFirst({
      where: and(
        eq(sessionTable.token, customToken),
        gt(sessionTable.expiresAt, new Date())
      )
    });
    if (dbSession) return dbSession.userId;
  }
  return null;
}

/**
 * DELETE - Delete a transaction
 */
export const DELETE: RequestHandler = async ({ request, cookies, params }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { id } = params;
    
    // Verify transaction belongs to user
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId)
      )
    });
    
    if (!transaction) {
      return json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    // Delete
    await db.delete(transactions).where(eq(transactions.id, id));
    
    console.log('Transaction deleted:', id);
    
    return json({ success: true });
    
  } catch (err: any) {
    console.error('Delete transaction error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

/**
 * PUT - Update a transaction
 */
export const PUT: RequestHandler = async ({ request, cookies, params }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { id } = params;
    const body = await request.json();
    
    // Verify transaction belongs to user
    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId)
      )
    });
    
    if (!existing) {
      return json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    // Update
    const [updated] = await db.update(transactions)
      .set({
        description: body.description ?? existing.description,
        amount: body.amount ? String(body.amount) : existing.amount,
        type: body.type ?? existing.type,
        categoryId: body.categoryId ?? existing.categoryId,
        date: body.date ? new Date(body.date) : existing.date,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date()
      })
      .where(eq(transactions.id, id))
      .returning();
    
    return json({ success: true, transaction: updated });
    
  } catch (err: any) {
    console.error('Update transaction error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
