
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
            fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: stock.fiftyTwoWeekLow ?? 0,
            ask: stock.ask ?? 0,
            bid: stock.bid ?? 0,
        }));
    } catch (error) {
        console.error('Error fetching stock data from Yahoo Finance:', error);
        return [];
    }
}

export async function getHistoricalData(ticker: string, period: '5d' | '1mo' | '3mo' | '1y' | 'max' = '3mo'): Promise<HistoricalHistoryResult | null> {
  if (!ticker) return null;

  const today = new Date();
  let startDate: Date;
  let interval: '1d' | '1wk' | '1mo' = '1d';

  switch (period) {
    case '5d':
      startDate = new Date();
      startDate.setDate(today.getDate() - 5);
      interval = '1d';
      break;
    case '1mo':
      startDate = new Date();
      startDate.setMonth(today.getMonth() - 1);
      interval = '1d';
      break;
    case '1y':
      startDate = new Date();
      startDate.setFullYear(today.getFullYear() - 1);
      interval = '1wk';
      break;
    case 'max':
      startDate = new Date(0); // Epoch start for all data
      interval = '1mo';
      break;
    case '3mo':
    default:
      startDate = new Date();
      startDate.setMonth(today.getMonth() - 3);
      interval = '1d';
      break;
  }
  
  try {
    const result = await yahooFinance.historical(ticker, {
      period1: startDate.toISOString().split('T')[0],
      period2: today.toISOString().split('T')[0],
      interval: interval,
    });
    return result;
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker} (${period}):`, error);
    return null;
  }
}

export async function searchStocks(query: string) {
    if (!query) {
        return [];
    }
    try {
        const searchResult = await yahooFinance.search(query, { newsCount: 0 });
        return searchResult.quotes.filter(q => q.symbol && (q.exchange.includes('NMS') || q.exchange.includes('NYQ') || q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))).map(stock => ({
            ticker: stock.symbol,
            name: stock.longname || stock.shortname || stock.symbol,
            exchange: stock.exchange,
        }));
    } catch (error) {
        console.error('Error searching stocks:', error);
        return [];
    }
}
