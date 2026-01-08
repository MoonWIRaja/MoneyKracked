import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';

/**
 * DEVELOPMENT ONLY: Delete all GitHub account links.
 * Access: GET /api/dev/reset-github-links
 */
export const GET: RequestHandler = async () => {
  // Only allow in development mode for security
  if (!dev) {
    return json({ error: 'This endpoint is only available in development mode' }, { status: 403 });
  }
  
  try {
    const result = await db.delete(account)
      .where(eq(account.providerId, 'github'));
    
    console.log('✅ All GitHub account links deleted');
    
    return json({ 
      success: true, 
      message: 'All GitHub account links deleted. Users must now explicitly link GitHub from Settings.' 
    });
  } catch (err: any) {
    console.error('Error deleting GitHub links:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
