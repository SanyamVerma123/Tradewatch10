"use server";

import { suggestPriceAlerts, SuggestPriceAlertsInput } from "@/ai/flows/suggest-price-alerts";
import yahooFinance from 'yahoo-finance2';

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
    try {
        const results = await yahooFinance.quote(tickers);
        return results.map(stock => ({
            ticker: stock.symbol,
            name: stock.longName || stock.shortName || 'N/A',
            price: stock.regularMarketPrice ?? 0,
            change: stock.regularMarketChange ?? 0,
            changePercent: stock.regularMarketChangePercent ?? 0,
            marketCap: stock.marketCap ?? 'N/A'
        }));
    } catch (error) {
        console.error('Error fetching stock data from Yahoo Finance:', error);
        return [];
    }
}
