"use server";

import { suggestPriceAlerts, SuggestPriceAlertsInput } from "@/ai/flows/suggest-price-alerts";
import yahooFinance from 'yahoo-finance2';
import type { HistoricalHistoryResult } from 'yahoo-finance2/dist/esm/src/modules/historical';

export async function getPriceAlertSuggestions(watchlist: { ticker: string; currentPrice: number }[]) {
  try {
    const input: SuggestPriceAlertsInput = { watchlist };
    const suggestions = await suggestPriceAlerts(input);
    return suggestions;
  } catch (error) {
    console.error("Error getting price alert suggestions:", error);
    // In a real app, you'd want more robust error handling.
    // For now, we return an empty array or throw the error.
    return [];
  }
}

export async function getStockData(tickers: string[]) {
    if (!tickers || tickers.length === 0) {
        return [];
    }
    try {
        const results = await yahooFinance.quote(tickers);
        return results.map(stock => ({
            ticker: stock.symbol,
            name: stock.longName || stock.shortName || 'N/A',
            price: stock.regularMarketPrice ?? 0,
            change: stock.regularMarketChange ?? 0,
            changePercent: stock.regularMarketChangePercent ?? 0,
            marketCap: stock.marketCap ?? 'N/A',
            open: stock.regularMarketOpen ?? 0,
            dayHigh: stock.regularMarketDayHigh ?? 0,
            dayLow: stock.regularMarketDayLow ?? 0,
            previousClose: stock.regularMarketPreviousClose ?? 0,
            volume: stock.regularMarketVolume ?? 0,
            avgVolume: stock.averageDailyVolume3Month ?? 0,
        }));
    } catch (error) {
        console.error('Error fetching stock data from Yahoo Finance:', error);
        return [];
    }
}

export async function getHistoricalData(ticker: string): Promise<HistoricalHistoryResult | null> {
  if (!ticker) return null;
  try {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const result = await yahooFinance.historical(ticker, {
      period1: threeMonthsAgo.toISOString().split('T')[0],
      period2: today.toISOString().split('T')[0],
      interval: '1d',
    });
    return result;
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker}:`, error);
    return null;
  }
}

export async function searchStocks(query: string) {
    if (!query) {
        return [];
    }
    try {
        // We append .NS to search specifically on the Indian NSE market
        const searchResult = await yahooFinance.search(`${query}`, { newsCount: 0 });
        return searchResult.quotes.filter(q => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))).map(stock => ({
            ticker: stock.symbol,
            name: stock.longname || stock.shortname || stock.symbol,
            exchange: stock.exchangecountry,
        }));
    } catch (error) {
        console.error('Error searching stocks:', error);
        return [];
    }
}
