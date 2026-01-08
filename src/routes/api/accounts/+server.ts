import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { financialAccounts } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET: List user accounts
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  try {
    const userAccounts = await db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.userId, locals.user.id));
    
    return json(userAccounts);
  } catch (err) {
    console.error('Get accounts error:', err);
    throw error(500, 'Failed to get accounts');
  }
};

// POST: Create account
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { name, type, currency, balance, icon, color } = await request.json();
  
  if (!name || !type) {
    throw error(400, 'Name and type are required');
  }
  
  try {
    const [account] = await db
      .insert(financialAccounts)
      .values({
        userId: locals.user.id,
        name,
        type,
        currency: currency || 'MYR',
        balance: (balance || 0).toString(),
        icon,
        color
      })
      .returning();
    
    return json(account, { status: 201 });
  } catch (err) {
    console.error('Create account error:', err);
    throw error(500, 'Failed to create account');
  }
};
