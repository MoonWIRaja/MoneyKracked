import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { BETTER_AUTH_URL } from '$env/static/private';

/**
 * Logout endpoint - clears all session cookies and redirects to login.
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const isSecure = BETTER_AUTH_URL?.startsWith('https');
  
  // Get custom session token
  const customToken = cookies.get('better-auth.session_token');
  
  // Delete session from database if exists
  if (customToken) {
    try {
      await db.delete(sessionTable)
        .where(eq(sessionTable.token, customToken));
      console.log('Session deleted from database');
    } catch (err) {
      console.error('Error deleting session from database:', err);
    }
  }
  
  // Clear all auth-related cookies
  cookies.delete('better-auth.session_token', { path: '/' });
  cookies.delete('better-auth.session_data', { path: '/' });
  
  console.log('User logged out, all session cookies cleared');
  
  // Redirect to login page
  throw redirect(303, '/login');
};
