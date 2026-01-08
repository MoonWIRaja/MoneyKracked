import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
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
 * PUT - Update category color
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const body = await request.json();
    const { categoryName, color } = body;
    
    if (!categoryName || !color) {
      return json({ error: 'categoryName and color are required' }, { status: 400 });
    }
    
    // Validate color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return json({ error: 'Invalid color format. Use hex format like #21c462' }, { status: 400 });
    }
    
    // Find the category
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.userId, userId),
        eq(categories.name, categoryName)
      )
    });
    
    if (!category) {
      return json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Update color
    await db.update(categories)
      .set({ color })
      .where(eq(categories.id, category.id));
    
    console.log(`Category "${categoryName}" color updated to ${color}`);
    
    return json({ success: true, categoryName, color });
    
  } catch (err: any) {
    console.error('Update category color error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};

/**
 * GET - List all categories for user
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const userCategories = await db.query.categories.findMany({
      where: eq(categories.userId, userId)
    });
    
    return json({ categories: userCategories });
    
  } catch (err: any) {
    console.error('Get categories error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
