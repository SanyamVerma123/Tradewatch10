
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import yahooFinance from 'yahoo-finance2';
import type { Order } from '@/lib/types';
import { marketDetails } from '@/hooks/use-market';

// Initialize Supabase Admin Client
// Note: Use environment variables for sensitive data in production
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const yahooFinanceOptions = {
    validateResult: false
};

// Heuristic to check if a specific market is open
function isMarketOpen(market: keyof typeof marketDetails) {
    const now = new Date();
    // This is a simplified check. A real implementation would use a library
    // that knows about all global market holidays and hours.
    // For this demo, we'll assume most markets are open during standard business hours in their timezone.
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    
    if (day === 0 || day === 6) return false; // Weekend
    
    // Rough check for typical market hours (e.g., 9 AM - 5 PM)
    if(hour > 1 && hour < 22) return true;

    return false;
}

async function executeOrder(orderToExecute: Order, ltp: number, userId: string) {
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderToExecute.id)
      .single();

    if (fetchError || !currentOrder || currentOrder.status !== 'Pending') {
      return { success: false, reason: 'Order already processed or not found' };
    }
    
    const market = currentOrder.market as keyof typeof marketDetails;

    const finalTradeValue = orderToExecute.quantity * ltp;
    const brokerage = Math.min(20, finalTradeValue * 0.0003); // Simplified brokerage

    let realizedPnl: number | undefined = undefined;

    if (orderToExecute.type === 'SELL') {
        const { data: purchaseOrders, error: poError } = await supabaseAdmin
            .from('orders')
            .select('quantity, limit_price')
            .eq('user_id', userId)
            .eq('market', market)
            .eq('ticker', orderToExecute.ticker)
            .eq('product', orderToExecute.product)
            .eq('type', 'BUY')
            .eq('status', 'Executed');

        if (poError) {
            console.error("Error fetching purchase orders for PNL calc", poError);
        } else if (purchaseOrders && purchaseOrders.length > 0) {
            let totalCost = 0;
            let totalQuantity = 0;
            for (const po of purchaseOrders) {
                totalCost += po.quantity * po.limit_price;
                totalQuantity += po.quantity;
            }
            const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
            if (avgBuyPrice > 0) {
              realizedPnl = (ltp - avgBuyPrice) * orderToExecute.quantity;
            }
        }
    }

    const executedOrderUpdate: Partial<Order> = { 
        status: 'Executed', 
        filled_quantity: orderToExecute.quantity, 
        ltp, 
        executed_at: new Date().toISOString(),
        realized_pnl: realizedPnl 
    };

    const { error: updateError } = await supabaseAdmin.from('orders').update(executedOrderUpdate).eq('id', orderToExecute.id);
    if (updateError) {
        return { success: false, reason: `Failed to update order: ${updateError.message}`};
    }
    
    // For a BUY order, the funds were already blocked. No further action needed.
    // For a SELL order, credit the funds to the user's account.
    if (orderToExecute.type === 'SELL') {
      const { data: fundsData, error: fundsError } = await supabaseAdmin.from('funds').select('balance').eq('user_id', userId).eq('market', market).single();
      if (fundsError || !fundsData) {
        return { success: false, reason: 'Failed to fetch user funds for sell transaction.' };
      }
      
      let newBalance = fundsData.balance + (finalTradeValue - brokerage);
      newBalance = Math.max(0, newBalance); // Ensure balance doesn't go negative
      await supabaseAdmin.from('funds').update({ balance: newBalance }).eq('user_id', userId).eq('market', market);
    }
    
    return { success: true, reason: `Executed ${orderToExecute.type} ${orderToExecute.quantity} ${orderToExecute.ticker}` };
}

export async function GET() {
  try {
    const { data: pendingOrders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('status', 'Pending');

    if (ordersError) {
        throw new Error(`Failed to fetch pending orders: ${ordersError.message}`);
    }

    if (!pendingOrders || pendingOrders.length === 0) {
        return NextResponse.json({ message: 'No pending orders to process.' });
    }

    const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
    const stockData = await getStockData(tickers);
    const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));
    
    const results = [];

    for (const order of pendingOrders) {
        const ltp = stockPriceMap.get(order.ticker);
        if (ltp === undefined) {
            results.push({ orderId: order.id, status: 'skipped', reason: `Could not fetch LTP for ${order.ticker}` });
            continue;
        }
        
        const marketIsOpen = isMarketOpen(order.market as keyof typeof marketDetails);
        let shouldExecute = false;
        let executionPrice = ltp;

        if (order.is_amo && marketIsOpen) { shouldExecute = true; } 
        else if (!order.is_amo && marketIsOpen) {
            if (order.order_method === "MARKET") { shouldExecute = true; }
            else if (order.order_method === "LIMIT") {
                if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                    shouldExecute = true;
                    executionPrice = order.limit_price;
                }
            } 
            else if (order.order_method === "SL") {
                if (order.trigger_price && ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price))) {
                    if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                       shouldExecute = true;
                       executionPrice = order.limit_price;
                    }
                }
            } 
            else if (order.order_method === "SL-M") {
                if (order.trigger_price && ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price))) {
                    shouldExecute = true;
                }
            }
        }
        
        if (shouldExecute) {
            const result = await executeOrder(order, executionPrice, order.user_id);
            results.push({ orderId: order.id, status: result.success ? 'executed' : 'failed', reason: result.reason });
        } else {
             results.push({ orderId: order.id, status: 'skipped', reason: 'Conditions not met' });
        }
    }
    
    return NextResponse.json({ message: 'Order execution cycle completed.', results });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to get stock data - can be shared with actions.ts
async function getStockData(tickers: string[]) {
    if (!tickers || tickers.length === 0) {
        return [];
    }
    try {
        const results = await yahooFinance.quote(tickers, {}, yahooFinanceOptions);
        return results.map(stock => ({
            ticker: stock.symbol,
            price: stock.regularMarketPrice ?? 0,
        }));
    } catch (error) {
        console.error('Error fetching stock data from Yahoo Finance:', error);
        return [];
    }
}
