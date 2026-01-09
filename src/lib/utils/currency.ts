/**
 * Currency Utility Functions
 * Handles currency conversion using exchange rates from the API
 */

export type Currency = 'MYR' | 'SGD' | 'USD';

export interface ExchangeRates {
  [fromCurrency: string]: {
    [toCurrency: string]: number;
  };
}

export interface CurrencyOptions {
  symbol?: boolean;
  code?: boolean;
}

// Currency symbols
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MYR: 'RM',
  SGD: 'S$',
  USD: '$'
};

// Currency names
export const CURRENCY_NAMES: Record<Currency, string> = {
  MYR: 'Malaysian Ringgit',
  SGD: 'Singapore Dollar',
  USD: 'US Dollar'
};

// Cached exchange rates
let cachedRates: ExchangeRates | null = null;
let ratesLastFetched: number | null = null;
const RATES_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch exchange rates from API
 */
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  // Return cached rates if still fresh
  if (cachedRates && ratesLastFetched && (Date.now() - ratesLastFetched < RATES_CACHE_TTL)) {
    return cachedRates;
  }

  try {
    const response = await fetch('/api/exchange-rates');
    const data = await response.json();

    if (data.success && data.rates) {
      cachedRates = data.rates;
      ratesLastFetched = Date.now();
      return data.rates;
    }

    // Return default rates if API fails
    return getDefaultRates();
  } catch (error) {
    console.error('[Currency] Failed to fetch rates:', error);
    return getDefaultRates();
  }
}

/**
 * Get default exchange rates (fallback)
 */
function getDefaultRates(): ExchangeRates {
  return {
    MYR: { MYR: 1, SGD: 0.31, USD: 0.22 },
    SGD: { MYR: 3.23, SGD: 1, USD: 0.71 },
    USD: { MYR: 4.55, SGD: 1.41, USD: 1 }
  };
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): Promise<number> {
  if (from === to) return amount;

  const rates = await fetchExchangeRates();

  // Get direct rate
  if (rates[from] && rates[from][to]) {
    return Math.round(amount * rates[from][to] * 100) / 100;
  }

  // Try reverse rate
  if (rates[to] && rates[to][from]) {
    return Math.round((amount / rates[to][from]) * 100) / 100;
  }

  // No conversion available
  return amount;
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options: CurrencyOptions = {}
): string {
  const { symbol = true, code = false } = options;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  if (code && symbol) {
    return `${CURRENCY_SYMBOLS[currency]}${formatted} ${currency}`;
  } else if (symbol) {
    return `${CURRENCY_SYMBOLS[currency]}${formatted}`;
  } else if (code) {
    return `${formatted} ${currency}`;
  }

  return formatted;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency];
}
