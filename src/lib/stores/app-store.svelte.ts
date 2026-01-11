/**
 * Shared App Store
 * Global state for exchange rates and user preferences
 * Cached across page navigations to avoid redundant API calls
 */

import type { Currency } from '$lib/utils/currency';

// Exchange rates cache
let cachedRates: Record<string, Record<string, number>> | null = null;
let ratesLastFetched: number | null = null;
let ratesPromise: Promise<Record<string, Record<string, number>>> | null = null;
const RATES_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// User preferences cache
let cachedPreferences: { currency: Currency } | null = null;
let prefsLastFetched: number | null = null;
let prefsPromise: Promise<{ currency: Currency } | null> | null = null;
const PREFS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default fallback rates
const DEFAULT_RATES: Record<string, Record<string, number>> = {
  MYR: { MYR: 1, SGD: 0.31, USD: 0.22 },
  SGD: { MYR: 3.23, SGD: 1, USD: 0.71 },
  USD: { MYR: 4.55, SGD: 1.41, USD: 1 }
};

/**
 * Get exchange rates (cached)
 */
export async function getExchangeRates(): Promise<Record<string, Record<string, number>>> {
  // Return cached if still fresh
  if (cachedRates && ratesLastFetched && (Date.now() - ratesLastFetched < RATES_CACHE_TTL)) {
    return cachedRates;
  }

  // Return existing promise if fetch is in progress
  if (ratesPromise) {
    return ratesPromise;
  }

  // Fetch new rates
  ratesPromise = (async () => {
    try {
      const response = await fetch('/api/exchange-rates', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.rates) {
        cachedRates = data.rates;
        ratesLastFetched = Date.now();
        return data.rates;
      }
    } catch (err) {
      console.error('[AppStore] Failed to fetch exchange rates:', err);
    }
    // Return default rates on error
    return DEFAULT_RATES;
  })();

  const result = await ratesPromise;
  ratesPromise = null;
  return result;
}

/**
 * Get user preferences (cached)
 */
export async function getUserPreferences(): Promise<{ currency: Currency } | null> {
  // Return cached if still fresh
  if (cachedPreferences && prefsLastFetched && (Date.now() - prefsLastFetched < PREFS_CACHE_TTL)) {
    return cachedPreferences;
  }

  // Return existing promise if fetch is in progress
  if (prefsPromise) {
    return prefsPromise;
  }

  // Fetch new preferences
  prefsPromise = (async () => {
    try {
      const response = await fetch('/api/preferences', { credentials: 'include' });
      const result = await response.json();
      if (result.preferences?.currency) {
        cachedPreferences = { currency: result.preferences.currency };
        prefsLastFetched = Date.now();
        return cachedPreferences;
      }
    } catch (err) {
      console.error('[AppStore] Failed to fetch preferences:', err);
    }
    return null;
  })();

  const result = await prefsPromise;
  prefsPromise = null;
  return result;
}

/**
 * Invalidate caches (call after updating preferences)
 */
export function invalidatePreferences() {
  cachedPreferences = null;
  prefsLastFetched = null;
}

/**
 * Initialize cache with server-preloaded data
 * Call this from layout with data from server load to skip API calls entirely
 */
export function initializeWithServerData(data: {
  rates: Record<string, Record<string, number>>;
  currency: Currency;
  theme?: string;
}) {
  // Cache exchange rates from server
  if (data.rates && Object.keys(data.rates).length > 0) {
    cachedRates = data.rates;
    ratesLastFetched = Date.now();
    ratesPromise = null; // Clear any pending fetch
  }

  // Cache preferences from server
  if (data.currency) {
    cachedPreferences = { currency: data.currency };
    prefsLastFetched = Date.now();
    prefsPromise = null; // Clear any pending fetch
  }
}

/**
 * Get cached exchange rates synchronously (if available)
 * Returns null if not cached yet
 */
export function getCachedRatesSync(): Record<string, Record<string, number>> | null {
  if (cachedRates && ratesLastFetched && (Date.now() - ratesLastFetched < RATES_CACHE_TTL)) {
    return cachedRates;
  }
  return null;
}

/**
 * Get cached preferences synchronously (if available)
 * Returns null if not cached yet
 */
export function getCachedPreferencesSync(): { currency: Currency } | null {
  if (cachedPreferences && prefsLastFetched && (Date.now() - prefsLastFetched < PREFS_CACHE_TTL)) {
    return cachedPreferences;
  }
  return null;
}

/**
 * Preload both exchange rates and preferences in parallel
 * Call this early (e.g., in layout) to speed up page loads
 */
export async function preloadAppData(): Promise<{
  exchangeRates: Record<string, Record<string, number>>;
  preferences: { currency: Currency } | null;
}> {
  const [exchangeRates, preferences] = await Promise.all([
    getExchangeRates(),
    getUserPreferences()
  ]);
  return { exchangeRates, preferences };
}

// ============================================================
// Theme Store - simple getter/setter pattern with Svelte 5 reactivity
// ============================================================
const themeState = $state({ value: 'dark' });

export function getAppTheme(): string {
  return themeState.value;
}

export function setAppTheme(theme: string) {
  themeState.value = theme;
  
  // Apply to document immediately
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

// ============================================================
// Sidebar Store - global control for mobile menu
// ============================================================
const sidebarState = $state({ isOpen: false });

export function getSidebarState() {
  return sidebarState.isOpen;
}

export function setSidebarState(isOpen: boolean) {
  sidebarState.isOpen = isOpen;
}

export function toggleSidebar() {
  sidebarState.isOpen = !sidebarState.isOpen;
}

