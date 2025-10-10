
"use server";

import { suggestPriceAlerts, SuggestPriceAlertsInput } from "@/ai/flows/suggest-price-alerts";
import { getStockAnalysis, GetStockAnalysisInput } from "@/ai/flows/stock-analysis";
import { getStockOfTheDay } from "@/ai/flows/stock-of-the-day";
import yahooFinance from 'yahoo-finance2';
import type { HistoricalHistoryResult } from 'yahoo-finance2/dist/esm/src/modules/historical';
import type { Market } from "@/hooks/use-market";
import { supabase } from '@/lib/supabase/client';
import type { Order } from '@/lib/types';
import { marketDetails } from '@/hooks/use-market';
import { v4 as uuidv4 } from 'uuid';

const yahooFinanceOptions = {
    validateResult: false
};

// --- START: In-App Order Execution Logic ---

// Heuristic to check if a specific market is open
function isMarketOpen(market: keyof typeof marketDetails): boolean {
    const marketInfo = marketDetails[market];
    if (!marketInfo) return false;

    const now = new Date();
    const marketTime = new Date(now.getTime() + marketInfo.offset * 3600 * 1000);
    const marketDay = marketTime.getUTCDay();
    const marketHour = marketTime.getUTCHours() + marketTime.getUTCMinutes() / 60;

    if (marketInfo.weekend_closure.includes(marketDay)) return false;
    return marketHour >= marketInfo.open && marketHour < marketInfo.close;
}

const createBracketOrders = async (parentOrder: Order) => {
    if (!parentOrder.id || (!parentOrder.stop_loss_value && !parentOrder.target_value)) return;
    
    const exitOrderType = parentOrder.type === 'BUY' ? 'SELL' : 'BUY';
    const newOrders: Omit<Order, 'id' | 'user_id'>[] = [];

    if (parentOrder.stop_loss_value) {
        newOrders.push({
            parent_order_id: parentOrder.id, type: exitOrderType, user_id: parentOrder.user_id,
            ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
            order_method: 'SL-M', trigger_price: parentOrder.stop_loss_value, product: parentOrder.product,
            is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
            exchange: parentOrder.exchange, order_type: `${parentOrder.product} SL-M`,
            limit_price: 0, filled_quantity: 0, ltp: parentOrder.ltp,
        });
    }

    if (parentOrder.target_value) {
        newOrders.push({
            parent_order_id: parentOrder.id, type: exitOrderType, user_id: parentOrder.user_id,
            ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
            order_method: 'LIMIT', limit_price: parentOrder.target_value, product: parentOrder.product,
            is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
            exchange: parentOrder.exchange, order_type: `${parentOrder.product} LIMIT`,
            filled_quantity: 0, ltp: parentOrder.ltp,
        });
    }
    
    if (newOrders.length > 0) {
        const ordersToInsert = newOrders.map(o => ({...o, id: uuidv4(), user_id: parentOrder.user_id}));
        await supabase.from('orders').insert(ordersToInsert);
    }
};

const cancelPeerBracketOrders = async (childOrder: Order) => {
    if (!childOrder.parent_order_id) return;
    const { data: peerOrders } = await supabase.from('orders').select('id')
        .eq('parent_order_id', childOrder.parent_order_id)
        .eq('status', 'Pending')
        .neq('id', childOrder.id);

    if (peerOrders && peerOrders.length > 0) {
        const idsToCancel = peerOrders.map(o => o.id);
        await supabase.from('orders').update({ status: 'Cancelled' }).in('id', idsToCancel);
    }
};

const executeOrder = async (orderToExecute: Order, ltp: number) => {
    let realizedPnl: number | undefined = undefined;

    if (orderToExecute.type === 'SELL') {
        const { data: purchaseOrders } = await supabase
            .from('orders').select('quantity, ltp')
            .eq('user_id', orderToExecute.user_id).eq('market', orderToExecute.market)
            .eq('ticker', orderToExecute.ticker).eq('product', orderToExecute.product)
            .eq('type', 'BUY').eq('status', 'Executed');

        if (purchaseOrders && purchaseOrders.length > 0) {
            let totalCost = 0;
            let totalQuantity = 0;
            purchaseOrders.forEach(po => {
                totalCost += po.quantity * po.ltp;
                totalQuantity += po.quantity;
            });
            const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
            if (avgBuyPrice > 0) {
              realizedPnl = (ltp - avgBuyPrice) * orderToExecute.quantity;
            }
        }
    }

    const executedOrderUpdate: Partial<Order> = { 
        status: 'Executed', filled_quantity: orderToExecute.quantity, ltp, 
        executed_at: new Date().toISOString(), realized_pnl: realizedPnl 
    };
    
    const { error: updateError } = await supabase.from('orders').update(executedOrderUpdate).eq('id', orderToExecute.id);
    if (updateError) { console.error("Failed to update order:", updateError); return; }
    
    if (orderToExecute.type === 'SELL') {
      const { data: fundsData } = await supabase.from('funds').select('balance').eq('user_id', orderToExecute.user_id).eq('market', orderToExecute.market!).single();
      if (fundsData) {
        const finalTradeValue = orderToExecute.quantity * ltp;
        let newBalance = fundsData.balance + finalTradeValue;
        await supabase.from('funds').update({ balance: newBalance }).eq('user_id', orderToExecute.user_id).eq('market', orderToExecute.market!);
      }
    }

    const executedOrderWithUpdate = { ...orderToExecute, ...executedOrderUpdate };
    
    if (!executedOrderWithUpdate.parent_order_id) {
        await createBracketOrders(executedOrderWithUpdate as Order);
    } else {
        await cancelPeerBracketOrders(executedOrderWithUpdate as Order);
    }
};

export async function executeInAppOrders() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { message: 'No authenticated user.' };

        const { data: pendingOrders, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'Pending');

        if (fetchError) throw fetchError;
        if (!pendingOrders || pendingOrders.length === 0) {
            return { message: 'No pending orders.' };
        }

        const tickersByMarket: { [key: string]: string[] } = {};
        for (const order of pendingOrders) {
            if (order.market) {
                if (!tickersByMarket[order.market]) tickersByMarket[order.market] = [];
                if (!tickersByMarket[order.market].includes(order.ticker)) {
                   tickersByMarket[order.market].push(order.ticker);
                }
            }
        }
        
        const stockPriceMap = new Map<string, number>();
        for (const market in tickersByMarket) {
            const liveData = await getStockData(tickersByMarket[market]);
            // IMPORTANT FIX: Handle both single object and array response from getStockData
            const dataArray = Array.isArray(liveData) ? liveData : [liveData];
            dataArray.forEach(stock => stockPriceMap.set(stock.ticker, stock.price));
        }

        let executedCount = 0;
        for (const order of pendingOrders) {
            const ltp = stockPriceMap.get(order.ticker);
            if (ltp === undefined) continue;
            
            const marketIsOpen = isMarketOpen(order.market as keyof typeof marketDetails);
            let shouldExecute = false;
            let executionPrice = ltp;

            if (marketIsOpen) {
                if (order.is_amo) {
                    shouldExecute = true; // Execute AMO as market order when market opens
                } else {
                     switch(order.order_method) {
                        case "MARKET":
                            shouldExecute = true;
                            break;
                        case "LIMIT":
                            if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                                shouldExecute = true;
                                executionPrice = order.limit_price;
                            }
                            break;
                        case "SL":
                            if (order.trigger_price) {
                                if ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price)) {
                                    if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                                        shouldExecute = true;
                                        executionPrice = order.limit_price;
                                    }
                                }
                            }
                            break;
                        case "SL-M":
                            if (order.trigger_price) {
                                if ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price)) {
                                    shouldExecute = true;
                                }
                            }
                            break;
                    }
                }
            }
            
            if (shouldExecute) {
                await executeOrder(order, executionPrice);
                executedCount++;
            }
        }
        
        return { message: `${executedCount} orders executed.` };

    } catch (error: any) {
        console.error("Error in in-app order execution:", error);
        return { message: `Error: ${error.message}` };
    }
}


// --- END: In-App Order Execution Logic ---


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
        const dataArray = Array.isArray(results) ? results : [results]; // Handle single object response
        return dataArray.map(stock => ({
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
    
    const marketExchanges: Record<Market, string[]> = {
        'IN': ['NSI', 'BSE'],
        'US': ['NMS', 'NYQ'],
        'GB': ['LSE'],
        'DE': ['GER', 'FKA'],
        'JP': ['JPX'],
        'HK': ['HKG'],
        'CA': ['TOR'],
    };
    
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
                if (exchanges.includes(q.exchange)) return true;
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

    