import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { exchangeRates } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/exchange-rates
 * Get current exchange rates
 */
export const GET: RequestHandler = async () => {
  try {
    const rates = await db.query.exchangeRates.findMany();

    // Format as a simple object for easy lookup
    const ratesMap: Record<string, Record<string, number>> = {};

    for (const rate of rates) {
      if (!ratesMap[rate.fromCurrency]) {
        ratesMap[rate.fromCurrency] = {};
      }
      ratesMap[rate.fromCurrency][rate.toCurrency] = parseFloat(rate.rate as string);
    }

    return json({
      success: true,
      rates: ratesMap,
      lastUpdated: rates.length > 0 ? rates[0].updatedAt : null
    });
  } catch (error: any) {
    console.error('[Exchange Rates] Error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};

/**
 * POST /api/exchange-rates
 * Update exchange rates (admin only or protected)
 * For now, allows updating rates
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { rates } = body; // { MYR: { SGD: 0.31, USD: 0.22 }, SGD: { MYR: 3.23, ... } }

    if (!rates || typeof rates !== 'object') {
      return json({ error: 'Rates object is required' }, { status: 400 });
    }

    // Update each rate
    for (const [fromCurrency, toRates] of Object.entries(rates)) {
      if (typeof toRates !== 'object' || toRates === null) continue;

      for (const [toCurrency, rate] of Object.entries(toRates || {})) {
        if (typeof rate !== 'number') continue;

        // Check if rate exists
        const existing = await db.query.exchangeRates.findFirst({
          where: and(
            eq(exchangeRates.fromCurrency, fromCurrency),
            eq(exchangeRates.toCurrency, toCurrency)
          )
        });

        if (existing) {
          await db.update(exchangeRates)
            .set({ rate: rate.toString(), updatedAt: new Date() })
            .where(eq(exchangeRates.id, existing.id));
        } else {
          await db.insert(exchangeRates).values({
            fromCurrency,
            toCurrency,
            rate: rate.toString(),
            source: 'manual'
          });
        }
      }
    }

    console.log('[Exchange Rates] Rates updated');

    return json({ success: true, message: 'Exchange rates updated' });
  } catch (error: any) {
    console.error('[Exchange Rates] Error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};
