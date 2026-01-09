import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface UserPreferences {
  currency: 'MYR' | 'SGD' | 'USD';
  theme: 'dark' | 'light' | 'system';
  notifications: boolean;
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
 * NOTE: Currency changes now only affect display, not stored data
 * Original currency is preserved for each transaction/budget/goal
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
