
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, PieChart, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useMarket, marketDetails } from "@/hooks/use-market";
import { getStockData } from "@/app/actions";
import type { User as SupabaseUser } from "@supabase/supabase-js";


// Heuristic to check if a specific market is open
function isMarketOpen(market: keyof typeof marketDetails) {
    const marketInfo = marketDetails[market];
    if (!marketInfo) return false;

    const now = new Date();
    // Use UTC hours and offset for reliability
    const utcHour = now.getUTCHours() + (now.getUTCMinutes() / 60);

    // Convert market open/close times to UTC
    const marketOpenUTC = marketInfo.open - marketInfo.offset;
    const marketCloseUTC = marketInfo.close - marketInfo.offset;

    const dayOfWeek = now.getUTCDay(); // Sunday = 0, Saturday = 6

    // Most markets are closed on weekends
    if (marketInfo.weekend_closure.includes(dayOfWeek)) {
        return false;
    }
    
    // Check if current UTC hour is within the market's UTC operating hours
    return utcHour >= marketOpenUTC && utcHour < marketCloseUTC;
}

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: UserIcon },
];


export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { market } = useMarket();

  // Bracket order logic: Create SL/Target orders after a parent order executes
  const createBracketOrders = async (parentOrder: Order) => {
      if (!parentOrder.id || (!parentOrder.stop_loss_value && !parentOrder.target_value)) return;
      
      const exitOrderType = parentOrder.type === 'BUY' ? 'SELL' : 'BUY';
      const newOrders: Omit<Order, 'id' | 'user_id'>[] = [];

      if (parentOrder.stop_loss_value) {
          newOrders.push({
              parent_order_id: parentOrder.id, type: exitOrderType,
              ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
              order_method: 'SL-M', trigger_price: parentOrder.stop_loss_value, product: parentOrder.product,
              is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
              exchange: parentOrder.exchange, order_type: `${parentOrder.product} SL-M`,
              limit_price: 0, filled_quantity: 0, ltp: parentOrder.ltp,
          });
      }

      if (parentOrder.target_value) {
          newOrders.push({
              parent_order_id: parentOrder.id, type: exitOrderType,
              ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
              order_method: 'LIMIT', limit_price: parentOrder.target_value, product: parentOrder.product,
              is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
              exchange: parentOrder.exchange, order_type: `${parentOrder.product} LIMIT`,
              filled_quantity: 0, ltp: parentOrder.ltp,
          });
      }
      
      if (newOrders.length > 0) {
          const ordersToInsert = newOrders.map(o => ({...o, user_id: parentOrder.user_id}));
          await supabase.from('orders').insert(ordersToInsert);
      }
  };

  // Bracket order logic: Cancel the other leg when one leg executes
  const cancelPeerBracketOrders = async (childOrder: Order) => {
      if (!childOrder.parent_order_id) return;
      const { data: peerOrders } = await supabase.from('orders').select('id')
          .eq('parent_order_id', childOrder.parent_order_id).eq('status', 'Pending').neq('id', childOrder.id);

      if (peerOrders && peerOrders.length > 0) {
          const idsToCancel = peerOrders.map(o => o.id);
          await supabase.from('orders').update({ status: 'Cancelled' }).in('id', idsToCancel);
      }
  };

  const executeOrder = useCallback(async (orderToExecute: Order, ltp: number) => {
    let realizedPnl: number | undefined = undefined;

    // Correct P&L Calculation for SELL orders
    if (orderToExecute.type === 'SELL') {
        const { data: purchaseOrders, error: poError } = await supabase
            .from('orders')
            .select('quantity, ltp')
            .eq('user_id', orderToExecute.user_id)
            .eq('market', orderToExecute.market)
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
                totalCost += po.quantity * po.ltp; // Use executed price (ltp at time of execution)
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
        ltp, // This is the execution price
        executed_at: new Date().toISOString(),
        realized_pnl: realizedPnl 
    };
    
    // Use the ID from the order object to update
    const { error: updateError } = await supabase.from('orders').update(executedOrderUpdate).eq('id', orderToExecute.id);
    if (updateError) {
        console.error("Failed to update order:", updateError);
        // TODO: Handle fund reversal if update fails
        return;
    }
    
    // After successful update, handle funds
    if (orderToExecute.type === 'SELL') {
      const { data: fundsData, error: fundsError } = await supabase.from('funds').select('balance').eq('user_id', orderToExecute.user_id).eq('market', market).single();
      if (!fundsError && fundsData) {
        const finalTradeValue = orderToExecute.quantity * ltp;
        // Correctly update balance: add proceeds for sell, PNL is for record-keeping
        let newBalance = fundsData.balance + finalTradeValue;
        await supabase.from('funds').update({ balance: newBalance }).eq('user_id', orderToExecute.user_id).eq('market', market);
      }
    }

    const executedOrderWithUpdate = { ...orderToExecute, ...executedOrderUpdate };
    
    // Reliably call bracket order logic
    if (!executedOrderWithUpdate.parent_order_id) { // This is a parent order
        await createBracketOrders(executedOrderWithUpdate as Order);
    } else { // This is a child (SL/Target) order
        await cancelPeerBracketOrders(executedOrderWithUpdate as Order);
    }
  }, [supabase, market, toast]);

  const checkPendingOrders = useCallback(async (sbUser: SupabaseUser) => {
    try {
        const { data: pendingOrders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', sbUser.id)
            .eq('status', 'Pending');
        
        if (error || !pendingOrders || pendingOrders.length === 0) return;

        const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
        const stockData = await getStockData(tickers);
        const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));
        
        for (const order of pendingOrders) {
            const ltp = stockPriceMap.get(order.ticker);
            if (ltp === undefined) continue;
            
            const marketIsOpen = isMarketOpen(order.market as keyof typeof marketDetails);
            let shouldExecute = false;
            let executionPrice = ltp;

            if (order.is_amo && marketIsOpen) {
                shouldExecute = true; // Execute AMO as market order when market opens
            } else if (!order.is_amo && marketIsOpen) {
                // Rigorous checks for different order methods
                switch(order.order_method) {
                    case "MARKET":
                        shouldExecute = true;
                        break;
                    case "LIMIT":
                        if ((order.type === 'BUY' && ltp <= order.limit_price) || (order.type === 'SELL' && ltp >= order.limit_price)) {
                            shouldExecute = true;
                            executionPrice = order.limit_price; // Execute at limit price
                        }
                        break;
                    case "SL":
                        if (order.trigger_price) {
                            if ((order.type === 'BUY' && ltp >= order.trigger_price) || (order.type === 'SELL' && ltp <= order.trigger_price)) {
                                // Trigger is hit, now it's a limit order. Check limit price.
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
                                // Trigger is hit, becomes a market order.
                                shouldExecute = true;
                            }
                        }
                        break;
                }
            }
            
            if (shouldExecute) {
                // Final check to prevent double execution in a race condition
                const { data: finalCheckOrder, error: checkError } = await supabase.from('orders').select('status').eq('id', order.id).single();
                if (checkError) {
                    console.error("Failed to re-check order status before execution:", checkError);
                    continue;
                }
                if (finalCheckOrder && finalCheckOrder.status === 'Pending') {
                   // Pass the full order object to executeOrder
                   await executeOrder(order, executionPrice);
                }
            }
        }
    } catch(e) {
        console.error("Error in checkPendingOrders:", e);
    }
  }, [supabase, executeOrder]);


  useEffect(() => {
    let sessionChecked = false;
    let orderInterval: NodeJS.Timeout;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sbUser = session?.user || null;
      setUser(sbUser);
      setIsLoading(false);
      sessionChecked = true;

      if (!sbUser && pathname !== '/') {
        router.replace('/');
        return;
      }
      
      if (sbUser) {
        // Initial check
        checkPendingOrders(sbUser);
        // Set up interval
        orderInterval = setInterval(() => {
          checkPendingOrders(sbUser);
        }, 5000);
      }
    };

    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const sbUser = session?.user || null;
        setUser(sbUser);
        
        clearInterval(orderInterval);
        if (sbUser) {
            checkPendingOrders(sbUser); // Immediate check on auth change
            orderInterval = setInterval(() => {
                checkPendingOrders(sbUser);
            }, 5000);
        }

        if (_event === 'SIGNED_OUT' && pathname !== '/') {
            router.replace('/');
        } else if (_event === 'SIGNED_IN' && pathname === '/') {
            router.replace('/watchlist');
        }
    });

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(orderInterval);
    };

  }, [pathname, router, checkPendingOrders]);

  const isLoggedIn = !!user;
  const hideOnPages = ['/', '/community'];
  if (hideOnPages.includes(pathname) || isLoading || !isLoggedIn) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
