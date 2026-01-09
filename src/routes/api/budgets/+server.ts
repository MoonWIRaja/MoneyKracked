import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { budgets, categories } from '$lib/server/db/schema';
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
 * GET - List all budgets for current user
 * Query params: month (1-12), year (YYYY)
 */
export const GET: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get month/year from query params (optional)
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');

    // Get budgets with category info
    const userBudgets = await db.query.budgets.findMany({
      where: eq(budgets.userId, userId),
      with: {
        category: true
      }
    });
    
    // Format response
    const formattedBudgets = userBudgets.map(b => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name || 'Unknown',
      categoryIcon: b.category?.icon || 'category',
      categoryColor: b.category?.color || '#6b7280',
      limitAmount: parseFloat(b.limitAmount),
      period: b.period,
      startDate: b.startDate,
      endDate: b.endDate,
      month: b.startDate ? new Date(b.startDate).getMonth() + 1 : null,
      year: b.startDate ? new Date(b.startDate).getFullYear() : null
    }));
    
    // Filter by month/year if specified
    let filteredBudgets = formattedBudgets;
    if (monthParam && yearParam) {
      const month = parseInt(monthParam);
      const year = parseInt(yearParam);
      filteredBudgets = formattedBudgets.filter(b => {
        // Include budgets without date (global) or matching month/year
        if (!b.startDate) return true;
        return b.month === month && b.year === year;
      });
    }
    
    return json({ budgets: filteredBudgets });
    
  } catch (err: any) {
    console.error('Get budgets error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

/**
 * POST - Create new budget(s)
 * Can accept single or batch creation
 * Supports month/year for date-specific budgets
 * Supports clearExisting option to remove all budgets for a specific month/year before creating new ones
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Support both single and batch creation
    const budgetItems = Array.isArray(body.budgets) ? body.budgets : [body];
    const clearExisting = body.clearExisting === true; // Option to clear existing budgets first

    // DEBUG: Log incoming request
    console.log(`[Budgets] POST request: clearExisting=${clearExisting}, items=${budgetItems.length}`,
      budgetItems.map((item: any) => ({
        categoryName: item.categoryName,
        amount: item.amount,
        month: item.month,
        year: item.year
      }))
    );

    // If clearExisting is true and we have month/year info, delete all budgets for that period first
    if (clearExisting && budgetItems.length > 0) {
      const firstItem = budgetItems[0];
      const { month, year } = firstItem;

      if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

        // DEBUG: Log what we're about to delete
        const existingBudgets = await db.query.budgets.findMany({
          where: eq(budgets.userId, userId)
        });
        console.log(`[Budgets] Before delete - User has ${existingBudgets.length} budgets:`,
          existingBudgets.map(b => ({
            id: b.id,
            categoryId: b.categoryId,
            limitAmount: b.limitAmount,
            startDate: b.startDate
          }))
        );

        // Delete all budgets for this month/year ONLY
        await db.delete(budgets)
          .where(and(
            eq(budgets.userId, userId),
            eq(budgets.startDate, startDate)
          ));

        console.log(`[Budgets] Cleared ${month}/${year} (startDate: ${startDate}) budgets before creating new ones`);
      } else {
        // CRITICAL: If no month/year specified but clearExisting is true, we should NOT delete anything!
        // This prevents accidentally deleting all budgets when creating global budgets
        console.warn(`[Budgets] clearExisting=true but no month/year provided. Skipping delete to prevent data loss.`);
      }
    }

    const createdBudgets = [];
    
    for (const item of budgetItems) {
      const { categoryName, categoryId, amount, period = 'monthly', month, year } = item;
      
      let targetCategoryId = categoryId;
      
      // If categoryName provided, find or create category
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
            type: 'expense'
          }).returning();
          category = newCategory;
        }
        
        targetCategoryId = category.id;
      }
      
      if (!targetCategoryId) {
        console.warn('No category found for budget:', item);
        continue;
      }
      
      // Calculate startDate and endDate from month/year
      let startDate = null;
      let endDate = null;
      if (month && year) {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        // Last day of month (note: month in Date constructor is 0-indexed, so we use month directly to get the 0th of next month = last day of current month)
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        console.log(`[Budgets] Creating budget for ${categoryName}: month=${month}, year=${year}, startDate=${startDate}`);
      } else {
        console.log(`[Budgets] Creating budget for ${categoryName}: NO month/year provided (global budget, startDate=null)`);
      }
      
      // Check if budget already exists for this category in this period
      let existingBudget;
      if (startDate) {
        existingBudget = await db.query.budgets.findFirst({
          where: and(
            eq(budgets.userId, userId),
            eq(budgets.categoryId, targetCategoryId),
            eq(budgets.startDate, startDate)
          )
        });
      } else {
        existingBudget = await db.query.budgets.findFirst({
          where: and(
            eq(budgets.userId, userId),
            eq(budgets.categoryId, targetCategoryId)
          )
        });
      }
      
      if (existingBudget) {
        // Update existing budget
        const [updated] = await db.update(budgets)
          .set({ 
            limitAmount: String(amount),
            period,
            updatedAt: new Date()
          })
          .where(eq(budgets.id, existingBudget.id))
          .returning();
        createdBudgets.push({ ...updated, action: 'updated' });
      } else {
        // Create new budget
        const [newBudget] = await db.insert(budgets).values({
          userId,
          categoryId: targetCategoryId,
          limitAmount: String(amount),
          period,
          startDate,
          endDate
        }).returning();
        createdBudgets.push({ ...newBudget, action: 'created' });
      }
    }
    
    return json({ 
      success: true, 
      budgets: createdBudgets,
      message: `${createdBudgets.length} budget(s) saved`
    });
    
  } catch (err: any) {
    console.error('Create budget error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

// Helper: Get icon for category name
function getCategoryIcon(name: string): string {
  const iconMap: Record<string, string> = {
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
