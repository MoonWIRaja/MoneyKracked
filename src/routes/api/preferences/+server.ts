import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

// Simple key-value preferences stored in a JSON column or separate table
// For now, we'll use localStorage on client + this API for persistence

interface UserPreferences {
  currency: 'MYR' | 'SGD' | 'USD';
  theme: 'dark' | 'light' | 'system';
  notifications: boolean;
}

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

// In-memory cache for preferences (will be replaced with proper DB storage)
// For now, use cookies as simple preference storage
const DEFAULT_PREFERENCES: UserPreferences = {
  currency: 'MYR',
  theme: 'dark',
  notifications: true
};

/**
 * GET - Load user preferences
 */
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    // Read from cookie
    const prefsCookie = cookies.get('user-preferences');
    
    if (prefsCookie) {
      try {
        const prefs = JSON.parse(prefsCookie);
        return json({ preferences: { ...DEFAULT_PREFERENCES, ...prefs } });
      } catch {
        // Invalid JSON, return defaults
      }
    }
    
    return json({ preferences: DEFAULT_PREFERENCES });
    
  } catch (err: any) {
    console.error('Get preferences error:', err);
    return json({ preferences: DEFAULT_PREFERENCES });
  }
};

/**
 * PUT - Update user preferences
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { currency, theme, notifications } = body;
    
    // Read existing preferences
    const prefsCookie = cookies.get('user-preferences');
    let prefs: UserPreferences = { ...DEFAULT_PREFERENCES };
    
    if (prefsCookie) {
      try {
        prefs = { ...prefs, ...JSON.parse(prefsCookie) };
      } catch {}
    }
    
    // Update with new values
    if (currency) prefs.currency = currency;
    if (theme !== undefined) prefs.theme = theme;
    if (notifications !== undefined) prefs.notifications = notifications;
    
    // Save to cookie (long-lived, 1 year)
    cookies.set('user-preferences', JSON.stringify(prefs), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false, // Allow client-side access
      secure: false, // Change to true in production with HTTPS
      sameSite: 'lax'
    });
    
    console.log('User preferences saved:', prefs);
    
    return json({ success: true, preferences: prefs });
    
  } catch (err: any) {
    console.error('Save preferences error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
