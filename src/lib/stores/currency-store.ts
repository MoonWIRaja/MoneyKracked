/**
 * Reactive currency store
 * All pages can subscribe to currency changes
 */

import type { Currency } from '$lib/utils/currency';
import { getExchangeRates, getCachedRatesSync } from './app-store.svelte';

// Current currency state
let currentCurrency: Currency = 'MYR';
let currentRates: Record<string, Record<string, number>> = {};
const listeners = new Set<(currency: Currency, rates: Record<string, Record<string, number>>) => void>();

/**
 * Default fallback rates - centralized source of truth
 */
const DEFAULT_FALLBACK_RATES: Record<string, number> = {
  SGD: 0.31,
  USD: 0.22,
  MYR: 1
};

/**
 * Subscribe to currency changes
 * Returns unsubscribe function
 */
export function subscribeToCurrency(
  callback: (currency: Currency, rates: Record<string, Record<string, number>>) => void
): () => void {
  listeners.add(callback);
  // Immediately call with current values
  callback(currentCurrency, currentRates);
  return () => listeners.delete(callback);
}

/**
 * Subscribe to currency changes WITHOUT immediate callback
 * Use this to avoid infinite loops during initialization
 */
export function subscribeToCurrencyLazy(
  callback: (currency: Currency, rates: Record<string, Record<string, number>>) => void
): () => void {
  listeners.add(callback);
  // DO NOT call immediately - let the component initialize first
  return () => listeners.delete(callback);
}

/**
 * Get current currency synchronously
 */
export function getCurrentCurrency(): Currency {
  return currentCurrency;
}

/**
 * Get current rates synchronously
 */
export function getCurrentRates(): Record<string, Record<string, number>> {
  return currentRates;
}

/**
 * Update currency and notify all listeners
 * Call this after currency changes
 */
export async function updateCurrency(currency: Currency) {
  const oldCurrency = currentCurrency;
  const oldRates = JSON.stringify(currentRates);

  currentCurrency = currency;

  // Fetch fresh rates
  try {
    const rates = await getExchangeRates();
    if (rates) {
      currentRates = rates;
    }
  } catch (err) {
    console.warn('[CurrencyStore] Failed to fetch fresh rates, checking cache...', err);
    // Use cached if available
    const cached = getCachedRatesSync();
    if (cached) {
      currentRates = cached;
    }
  }

  // Prevent redundant updates if nothing actually changed
  if (oldCurrency === currentCurrency && oldRates === JSON.stringify(currentRates)) {
    return;
  }

  // Notify all listeners
  notifyListeners();
}

/**
 * Initialize currency store
 */
export async function initializeCurrencyStore(initialCurrency: Currency) {
  currentCurrency = initialCurrency;
  try {
    const rates = await getExchangeRates();
    if (rates) {
      currentRates = rates;
    }
  } catch (err) {
    console.error('[CurrencyStore] Init failed:', err);
  }
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener(currentCurrency, currentRates);
    } catch (err) {
      console.error('[CurrencyStore] Listener error:', err);
    }
  });
}

/**
 * Convert amount from MYR to selected currency
 */
export function convertAmountMYR(
  amountMYR: number,
  selectedCurrency: Currency = currentCurrency,
  exchangeRates: Record<string, Record<string, number>> = currentRates
): number {
  if (typeof amountMYR !== 'number' || isNaN(amountMYR)) return 0;
  if (selectedCurrency === 'MYR') return amountMYR;

  // 1. Try to use provided exchange rates
  const rate = exchangeRates?.MYR?.[selectedCurrency];
  if (typeof rate === 'number' && rate > 0) {
    return Math.round(amountMYR * rate * 100) / 100;
  }

  // 2. Fallback to centralized default rates
  const fallbackRate = DEFAULT_FALLBACK_RATES[selectedCurrency];
  if (fallbackRate) {
    return Math.round(amountMYR * fallbackRate * 100) / 100;
  }

  return amountMYR;
}

/**
 * Convert amount from selected currency back to MYR
 */
export function convertToMYR(
  amount: number,
  selectedCurrency: Currency = currentCurrency,
  exchangeRates: Record<string, Record<string, number>> = currentRates
): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  if (selectedCurrency === 'MYR') return amount;

  // 1. Try to use provided exchange rates
  const rate = exchangeRates?.MYR?.[selectedCurrency];
  if (typeof rate === 'number' && rate > 0) {
    return Math.round((amount / rate) * 100) / 100;
  }

  // 2. Fallback to centralized default rates
  const fallbackRate = DEFAULT_FALLBACK_RATES[selectedCurrency];
  if (typeof fallbackRate === 'number' && fallbackRate > 0) {
    return Math.round((amount / fallbackRate) * 100) / 100;
  }

  return amount;
}

