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
    const { payee, amount, type, categoryId, categoryName, date, notes } = body;

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

    // Handle category - if categoryName provided, find or create category
    let targetCategoryId = categoryId ?? existing.categoryId;
    if (categoryName && !categoryId) {
      const { categories } = await import('$lib/server/db/schema');

      let category = await db.query.categories.findFirst({
        where: and(
          eq(categories.userId, userId),
          eq(categories.name, categoryName)
        )
      });

      // If not found, try system categories
      if (!category) {
        category = await db.query.categories.findFirst({
          where: and(
            eq(categories.isSystem, true),
            eq(categories.name, categoryName)
          )
        });
      }

      // If still not found, create new category
      if (!category) {
        const [newCategory] = await db.insert(categories).values({
          userId,
          name: categoryName,
          icon: getCategoryIcon(categoryName),
          color: getCategoryColor(categoryName),
          type: type === 'income' ? 'income' : 'expense'
        }).returning();
        category = newCategory;
      }

      targetCategoryId = category.id;
    }

    // Update
    const [updated] = await db.update(transactions)
      .set({
        payee: payee !== undefined ? (payee && payee.trim()) ? payee.trim() : null : existing.payee,
        amount: amount ? String(amount) : existing.amount,
        type: type ?? existing.type,
        categoryId: targetCategoryId,
        date: date ? new Date(date) : existing.date,
        notes: notes !== undefined ? notes || null : existing.notes,
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

// Helper: Get icon for category name
function getCategoryIcon(name: string): string {
  const iconMap: Record<string, string> = {
    'income': 'payments',
    'food & dining': 'restaurant',
    'food': 'restaurant',
    'dining': 'restaurant',
    'transportation': 'directions_car',
    'transport': 'directions_car',
    'utilities': 'bolt',
    'housing': 'home',
    'rent': 'home',
    'entertainment': 'sports_esports',
    'shopping': 'shopping_bag',
    'healthcare': 'medical_services',
    'savings': 'savings',
    'motorcycle': 'two_wheeler',
    'car loan': 'directions_car',
    'loan': 'payments',
    'insurance': 'health_and_safety',
    'internet': 'wifi',
    'phone': 'phone_android',
    'education': 'school',
    'other': 'category'
  };

  const lowerName = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lowerName.includes(key)) return icon;
  }
  return 'category';
}

// Helper: Get color for category name
function getCategoryColor(name: string): string {
  const colorMap: Record<string, string> = {
    'income': '#10b981',
    'food': '#f59e0b',
    'dining': '#f59e0b',
    'transportation': '#3b82f6',
    'utilities': '#8b5cf6',
    'housing': '#10b981',
    'entertainment': '#ec4899',
    'shopping': '#6366f1',
    'healthcare': '#ef4444',
    'savings': '#21c462',
    'loan': '#f97316',
    'other': '#6b7280'
  };

  const lowerName = name.toLowerCase();
  for (const [key, color] of Object.entries(colorMap)) {
    if (lowerName.includes(key)) return color;
  }
  return '#6b7280';
}
