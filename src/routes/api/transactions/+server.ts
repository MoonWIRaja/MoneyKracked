import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transactions, categories, financialAccounts } from '$lib/server/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { getUserId } from '$lib/server/session';

/**
 * GET - List transactions with optional filters
 * Query params: startDate, endDate, category, type
 */
export const GET: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Build query conditions
    let whereConditions: any[] = [eq(transactions.userId, userId)];
    
    // Date filters
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    if (startDate) {
      whereConditions.push(gte(transactions.date, new Date(startDate)));
    }
    if (endDate) {
      whereConditions.push(lte(transactions.date, new Date(endDate)));
    }
    
    // Type filter
    const type = url.searchParams.get('type');
    if (type && (type === 'income' || type === 'expense' || type === 'transfer')) {
      whereConditions.push(eq(transactions.type, type));
    }
    
    // Get transactions with category
    const userTransactions = await db.query.transactions.findMany({
      where: and(...whereConditions),
      with: {
        category: true
      },
      orderBy: [desc(transactions.date), desc(transactions.createdAt)]
    });
    
    // Format response
    const formattedTransactions = userTransactions.map(t => ({
      id: t.id,
      payee: t.payee || 'No description',
      amount: parseFloat(t.amount),
      type: t.type,
      date: t.date,
      categoryId: t.categoryId,
      categoryName: t.category?.name || 'Uncategorized',
      categoryIcon: t.category?.icon || 'category',
      categoryColor: t.category?.color || '#6b7280',
      notes: t.notes
    }));
    
    return json({ transactions: formattedTransactions });
    
  } catch (err: any) {
    console.error('Get transactions error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

/**
 * POST - Create new transaction
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { payee, amount, type, categoryId, categoryName, date, notes, accountId } = body;

    if (!amount || !type) {
      return json({ error: 'amount and type are required' }, { status: 400 });
    }

    // Find or create category if categoryName provided
    let targetCategoryId = categoryId;
    if (categoryName && !categoryId) {
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

    // Get or create default financial account for the user
    let targetAccountId = accountId;
    if (!targetAccountId) {
      // Try to find an existing account for this user
      const existingAccount = await db.query.financialAccounts.findFirst({
        where: eq(financialAccounts.userId, userId)
      });

      if (existingAccount) {
        targetAccountId = existingAccount.id;
      } else {
        // Create a default account if none exists
        const [newAccount] = await db.insert(financialAccounts).values({
          userId,
          name: 'Cash',
          type: 'cash',
          balance: '0'
        }).returning();
        targetAccountId = newAccount.id;
      }
    }

    // Create transaction
    const [newTransaction] = await db.insert(transactions).values({
      userId,
      accountId: targetAccountId,
      payee: (payee && payee.trim()) ? payee.trim() : null,
      amount: String(amount),
      type,
      categoryId: targetCategoryId || null,
      date: date ? new Date(date) : new Date(),
      notes: notes || null
    }).returning();

    console.log('Transaction created:', newTransaction.id);

    return json({ success: true, transaction: newTransaction });

  } catch (err: any) {
    console.error('Create transaction error:', err);
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
