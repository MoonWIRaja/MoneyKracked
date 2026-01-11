import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

// Cache exchange rates for 10 minutes
let cachedRates: Record<string, Record<string, number>> | null = null;
let ratesCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
  // Get preferences from cookie (fast, no DB query)
  let currency = 'MYR';
  let theme = 'dark';
  try {
    const prefsCookie = cookies.get('user-preferences');
    if (prefsCookie) {
      const prefs = JSON.parse(prefsCookie);
      currency = prefs.currency || 'MYR';
      theme = prefs.theme || 'dark';
    }
  } catch { }

  // Use cached rates if available and fresh
  const now = Date.now();
  if (!cachedRates || now - ratesCacheTime > CACHE_TTL) {
    const ratesData = await db.query.exchangeRates.findMany();
    const ratesMap: Record<string, Record<string, number>> = {};
    for (const rate of ratesData) {
      if (!ratesMap[rate.fromCurrency]) {
        ratesMap[rate.fromCurrency] = {};
      }
      ratesMap[rate.fromCurrency][rate.toCurrency] = parseFloat(rate.rate as string);
    }
    cachedRates = ratesMap;
    ratesCacheTime = now;
  }

  return {
    rates: cachedRates,
    currency,
    theme,
    // Pass user from locals (set by hooks.server.ts session check)
    user: locals.user ? {
      id: locals.user.id,
      email: locals.user.email,
      name: locals.user.name,
      image: locals.user.image
    } : null
  };
};
