
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client'; // Using the admin client for elevated privileges
import type { Order } from '@/lib/types';
import { getStockData } from '@/app/actions';
import { marketDetails } from '@/hooks/use-market';
import { v4 as uuidv4 } from 'uuid';

// Heuristic to check if a specific market is open
function isMarketOpen(market: keyof typeof marketDetails): boolean {
    const marketInfo = marketDetails[market];
    if (!marketInfo) return false;

    // Create a date object representing the current time in UTC
    const now = new Date();
    
    // Calculate the current time in the market's timezone
    const marketTime = new Date(now.getTime() + marketInfo.offset * 3600 * 1000);
    
    const marketDay = marketTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const marketHour = marketTime.getUTCHours() + marketTime.getUTCMinutes() / 60;

    // Check for weekend closure
    if (marketInfo.weekend_closure.includes(marketDay)) {
        return false;
    }

    // Check if within trading hours
    return marketHour >= marketInfo.open && marketHour < marketInfo.close;
}


// --- Bracket Order Logic ---

// Create SL/Target orders after a parent order executes
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
        // Add UUIDs to new orders
        const ordersToInsert = newOrders.map(o => ({...o, id: uuidv4(), user_id: parentOrder.user_id}));
        await supabase.from('orders').insert(ordersToInsert);
    }
};

// Cancel the other leg when one bracket leg executes
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

// --- Main Execution Logic ---

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
    
    // After successful update, handle funds
    if (orderToExecute.type === 'SELL') {
      const { data: fundsData } = await supabase.from('funds').select('balance').eq('user_id', orderToExecute.user_id).eq('market', orderToExecute.market!).single();
      if (fundsData) {
        const finalTradeValue = orderToExecute.quantity * ltp;
        let newBalance = fundsData.balance + finalTradeValue; // Add full proceeds of sale
        await supabase.from('funds').update({ balance: newBalance }).eq('user_id', orderToExecute.user_id).eq('market', orderToExecute.market!);
      }
    }

    const executedOrderWithUpdate = { ...orderToExecute, ...executedOrderUpdate };
    
    if (!executedOrderWithUpdate.parent_order_id) { // Parent order
        await createBracketOrders(executedOrderWithUpdate as Order);
    } else { // Child (SL/Target) order
        await cancelPeerBracketOrders(executedOrderWithUpdate as Order);
    }
};

// The main GET endpoint for the cron job
export async function GET() {
    try {
        console.log("Cron job started: checking pending orders.");
        
        // Fetch all pending orders from the database
        const { data: pendingOrders, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'Pending');

        if (fetchError) throw fetchError;
        if (!pendingOrders || pendingOrders.length === 0) {
            return NextResponse.json({ message: 'No pending orders to process.' });
        }
        
        console.log(`Found ${pendingOrders.length} pending orders.`);

        // Group tickers by market to make efficient API calls
        const tickersByMarket: { [key: string]: string[] } = {};
        for (const order of pendingOrders) {
            if (order.market) {
                if (!tickersByMarket[order.market]) {
                    tickersByMarket[order.market] = [];
                }
                if (!tickersByMarket[order.market].includes(order.ticker)) {
                   tickersByMarket[order.market].push(order.ticker);
                }
            }
        }
        
        const stockPriceMap = new Map<string, number>();

        // Fetch live prices for all relevant tickers
        for (const market in tickersByMarket) {
            const liveData = await getStockData(tickersByMarket[market]);
            liveData.forEach(stock => stockPriceMap.set(stock.ticker, stock.price));
        }

        let executedCount = 0;
        
        for (const order of pendingOrders) {
            const ltp = stockPriceMap.get(order.ticker);
            if (ltp === undefined) continue;
            
            const marketIsOpen = isMarketOpen(order.market as keyof typeof marketDetails);
            let shouldExecute = false;
            let executionPrice = ltp; // Default to LTP for Market orders

            if (order.is_amo && marketIsOpen) {
                shouldExecute = true; // Execute AMO as market order
            } else if (!order.is_amo && marketIsOpen) {
                 switch(order.order_method) {
                    case "MARKET":
                        shouldExecute = true;
                        break;
                    case "LIMIT":
                        if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                            shouldExecute = true;
                            executionPrice = order.limit_price; // Use the limit price for execution
                        }
                        break;
                    case "SL":
                        if (order.trigger_price) {
                            if ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price)) {
                                // Trigger is hit, now check limit condition
                                if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                                    shouldExecute = true;
                                    executionPrice = order.limit_price; // Execute at the limit price
                                }
                            }
                        }
                        break;
                    case "SL-M":
                        if (order.trigger_price) {
                            if ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price)) {
                                shouldExecute = true;
                                // executionPrice is already ltp, which is correct for a market order
                            }
                        }
                        break;
                }
            }
            
            if (shouldExecute) {
                await executeOrder(order, executionPrice);
                executedCount++;
            }
        }
        
        console.log(`Cron job finished. Executed ${executedCount} orders.`);
        return NextResponse.json({ message: `Processing complete. ${executedCount} orders executed.` });

    } catch (error: any) {
        console.error("Error in cron job:", error);
        return new NextResponse(`Error processing orders: ${error.message}`, { status: 500 });
    }
}
