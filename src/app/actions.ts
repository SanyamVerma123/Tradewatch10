
"use server";

import { suggestPriceAlerts, SuggestPriceAlertsInput } from "@/ai/flows/suggest-price-alerts";
import { getStockAnalysis, GetStockAnalysisInput } from "@/ai/flows/stock-analysis";
import { getStockOfTheDay } from "@/ai/flows/stock-of-the-day";
import yahooFinance from 'yahoo-finance2';
import type { HistoricalHistoryResult } from 'yahoo-finance2/dist/esm/src/modules/historical';
import type { Market } from "@/hooks/use-market";

const yahooFinanceOptions = {
    validateResult: false
};

export async function getStockOfTheDayAction() {
    try {
        const analysis = await getStockOfTheDay();
        return analysis;
    } catch (error) {
        console.error("Error getting stock of the day:", error);
        return null;
    }
}


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

export async function getStockAnalysisAction(input: GetStockAnalysisInput) {
    try {
        const analysis = await getStockAnalysis(input);
        return analysis;
    } catch (error) {
        console.error("Error getting stock analysis:", error);
        return null;
    }
}


export async function getStockData(tickers: string[]) {
    if (!tickers || tickers.length === 0) {
        return [];
    }
    try {
        const results = await yahooFinance.quote(tickers, {}, yahooFinanceOptions);
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
    }, yahooFinanceOptions);
    return result;
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker} (${period}):`, error);
    return null;
  }
}

export async function searchStocks(query: string, market: Market = 'IN') {
    if (!query) {
        return [];
    }
    
    // Exchange codes for different markets
    const marketExchanges: Record<Market, string[]> = {
        'IN': ['NSI', 'BSE'],
        'US': ['NMS', 'NYQ'],
        'GB': ['LSE'],
        'DE': ['GER', 'FKA'], // GER for XETRA, FKA for Frankfurt
        'JP': ['JPX'],
        'HK': ['HKG'],
        'CA': ['TOR'],
    };
    
    // Ticker suffixes for different markets
    const marketSuffixes: Record<Market, string[]> = {
        'IN': ['.NS', '.BO'],
        'US': [],
        'GB': ['.L'],
        'DE': ['.DE', '.F'],
        'JP': ['.T'],
        'HK': [],
        'CA': ['.TO'],
    };

    try {
        const searchResult = await yahooFinance.search(query, { newsCount: 0 }, yahooFinanceOptions);
        
        const exchanges = marketExchanges[market] || [];
        const suffixes = marketSuffixes[market] || [];

        const relevantQuotes = searchResult.quotes.filter(q => {
            if (q.symbol && q.exchange) {
                // Check if exchange matches
                if (exchanges.includes(q.exchange)) return true;
                // Check if ticker has the correct suffix
                if (suffixes.some(suffix => q.symbol.endsWith(suffix))) return true;
            }
            return false;
        });
        
        return relevantQuotes.map(stock => ({
            ticker: stock.symbol,
            name: stock.longname || stock.shortname || stock.symbol,
            exchange: stock.exchange,
        }));
    } catch (error) {
        console.error('Error searching stocks:', error);
        return [];
    }
}

export async function getMarketNews(market: Market = 'IN') {
     const queries: Record<Market, string> = {
        'IN': 'NIFTY 50',
        'US': 'S&P 500',
        'GB': 'FTSE 100',
        'DE': 'DAX',
        'JP': 'Nikkei 225',
        'HK': 'Hang Seng',
        'CA': 'TSX Composite',
    };
    
    try {
        const searchResult = await yahooFinance.search(queries[market], { newsCount: 10,  }, yahooFinanceOptions);
        if (!searchResult.news) return null;
        
        return searchResult.news.map((article: any, index: number) => {
            const imageUrl = article.thumbnail?.resolutions?.[0]?.url;
            return {
                id: article.uuid,
                headline: article.title,
                source: article.publisher,
                time: new Date(article.providerPublishTime * 1000).toLocaleString(),
                image: imageUrl || `https://picsum.photos/seed/news${index + 1}/400/200`,
                url: article.link,
            };
        });
    } catch (error) {
        console.error("Error fetching news from Yahoo Finance:", error);
        return null;
    }
}
