
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import yahooFinance from 'yahoo-finance2';
import type { Order } from '@/lib/types';
import { marketDetails } from '@/hooks/use-market';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const yahooFinanceOptions = {
    validateResult: false
};

// Market open/close times in UTC for simplicity in this example
// A robust solution would use a library aware of market holidays, specific exchange hours, etc.
const marketHours: { [key: string]: { open: number, close: number, offset: number } } = {
    'IN': { open: 3.75, close: 10, offset: 5.5 }, // 9:15 AM - 3:30 PM IST
    'US': { open: 14.5, close: 21, offset: -4 },  // 9:30 AM - 4:00 PM EDT
    'GB': { open: 8, close: 16.5, offset: 1 },    // 8:00 AM - 4:30 PM BST
    'DE': { open: 7, close: 15.5, offset: 2 },    // 9:00 AM - 5:30 PM CEST
    'JP': { open: 0, close: 6, offset: 9 },      // 9:00 AM - 3:00 PM JST
    'HK': { open: 1.5, close: 8, offset: 8 },      // 9:30 AM - 4:00 PM HKT
    'CA': { open: 13.5, close: 20, offset: -4 },   // 9:30 AM - 4:00 PM EDT
};


// Heuristic to check if a specific market is open
function isMarketOpen(market: keyof typeof marketDetails) {
    const marketInfo = marketHours[market];
    if (!marketInfo) return false; // Default to closed if market not defined

    const now = new Date();
    const day = now.getUTCDay();
    
    // Check for weekends (Saturday=6, Sunday=0)
    if (day === 0 || day === 6) return false; 
    
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;

    if (utcHour >= marketInfo.open && utcHour <= marketInfo.close) {
        return true;
    }

    return false;
}

async function createBracketOrders(executedOrder: Order) {
    const exitOrderType = executedOrder.type === 'BUY' ? 'SELL' : 'BUY';
    const newOrders: Partial<Order>[] = [];

    // Create Stop Loss Order
    if (executedOrder.stop_loss_value) {
        newOrders.push({
            user_id: executedOrder.user_id,
            parent_order_id: executedOrder.id,
            type: exitOrderType,
            ticker: executedOrder.ticker,
            quantity: executedOrder.quantity,
            status: 'Pending',
            order_method: 'SL-M', // Stop Loss Market
            trigger_price: executedOrder.stop_loss_value,
            product: executedOrder.product,
            is_amo: false,
            timestamp: new Date().toISOString(),
            market: executedOrder.market,
            exchange: executedOrder.exchange,
            order_type: `${executedOrder.product} SL-M`,
            limit_price: 0, // Market order, no limit price
            filled_quantity: 0,
            ltp: executedOrder.ltp,
        });
    }

    // Create Target Order
    if (executedOrder.target_value) {
        newOrders.push({
            user_id: executedOrder.user_id,
            parent_order_id: executedOrder.id,
            type: exitOrderType,
            ticker: executedOrder.ticker,
            quantity: executedOrder.quantity,
            status: 'Pending',
            order_method: 'LIMIT',
            limit_price: executedOrder.target_value,
            product: executedOrder.product,
            is_amo: false,
            timestamp: new Date().toISOString(),
            market: executedOrder.market,
            exchange: executedOrder.exchange,
            order_type: `${executedOrder.product} LIMIT`,
            filled_quantity: 0,
            ltp: executedOrder.ltp,
        });
    }
    
    if (newOrders.length > 0) {
        const { error } = await supabaseAdmin.from('orders').insert(newOrders);
        if (error) {
            console.error('Error creating bracket orders:', error);
            // This is a non-critical error, the main order is already executed.
            // We should log this for monitoring.
        }
    }
}

async function cancelPeerBracketOrders(executedOrder: Order) {
    if (!executedOrder.parent_order_id) return;

    // Find other pending bracket orders with the same parent_order_id and cancel them
    const { data: peerOrders, error } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('parent_order_id', executedOrder.parent_order_id)
        .eq('status', 'Pending')
        .neq('id', executedOrder.id); // Exclude the order that was just executed

    if (error) {
        console.error('Error fetching peer bracket orders to cancel:', error);
        return;
    }

    if (peerOrders && peerOrders.length > 0) {
        const idsToCancel = peerOrders.map(o => o.id);
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Cancelled' })
            .in('id', idsToCancel);
    }
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

    const executedOrderWithUpdate = { ...orderToExecute, ...executedOrderUpdate };
    
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
    
    // After execution, check if we need to create bracket orders (SL/Target)
    // Only do this for the primary entry order, not for the SL/Target orders themselves.
    if (!executedOrderWithUpdate.parent_order_id) {
        await createBracketOrders(executedOrderWithUpdate);
    } else {
        // If this was a SL/Target order that got executed, cancel its peer.
        await cancelPeerBracketOrders(executedOrderWithUpdate);
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
