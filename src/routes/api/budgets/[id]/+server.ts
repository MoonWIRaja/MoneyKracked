import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { budgets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '$lib/server/session';

/**
 * PUT - Update a budget
 */
export const PUT: RequestHandler = async ({ request, cookies, params }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const budgetId = params.id;
    const body = await request.json();
    const { amount, period } = body;
    
    // Verify ownership
    const budget = await db.query.budgets.findFirst({
      where: and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, userId)
      )
    });
    
    if (!budget) {
      return json({ error: 'Budget not found' }, { status: 404 });
    }
    
    // Update budget
    const [updated] = await db.update(budgets)
      .set({
        limitAmount: amount ? String(amount) : budget.limitAmount,
        period: period || budget.period,
        updatedAt: new Date()
      })
      .where(eq(budgets.id, budgetId))
      .returning();
    
    return json({ success: true, budget: updated });
    
  } catch (err: any) {
    console.error('Update budget error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

/**
 * DELETE - Remove a budget
 */
export const DELETE: RequestHandler = async ({ request, cookies, params }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const budgetId = params.id;
    
    // Verify ownership
    const budget = await db.query.budgets.findFirst({
      where: and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, userId)
      )
    });
    
    if (!budget) {
      return json({ error: 'Budget not found' }, { status: 404 });
    }
    
    // Delete budget
    await db.delete(budgets).where(eq(budgets.id, budgetId));
    
    return json({ success: true, message: 'Budget deleted' });
    
  } catch (err: any) {
    console.error('Delete budget error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
