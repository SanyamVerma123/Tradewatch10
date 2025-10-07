
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


  const executeOrder = useCallback(async (orderToExecute: Order, ltp: number) => {
    const market = orderToExecute.market as keyof typeof marketDetails;
    const finalTradeValue = orderToExecute.quantity * ltp;
    let realizedPnl: number | undefined = undefined;

    if (orderToExecute.type === 'SELL') {
        const { data: purchaseOrders, error: poError } = await supabase
            .from('orders')
            .select('quantity, limit_price')
            .eq('user_id', orderToExecute.user_id)
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

    const { error: updateError } = await supabase.from('orders').update(executedOrderUpdate).eq('id', orderToExecute.id);
    if (updateError) {
        console.error("Failed to update order:", updateError);
        return;
    }

    const executedOrderWithUpdate = { ...orderToExecute, ...executedOrderUpdate };
    
    if (orderToExecute.type === 'SELL') {
      const { data: fundsData, error: fundsError } = await supabase.from('funds').select('balance').eq('user_id', orderToExecute.user_id).eq('market', market).single();
      if (!fundsError && fundsData) {
        let newBalance = fundsData.balance + finalTradeValue;
        await supabase.from('funds').update({ balance: newBalance }).eq('user_id', orderToExecute.user_id).eq('market', market);
      }
    }

    // Bracket order logic
    const createBracketOrders = async (parentOrder: Order) => {
        if (!parentOrder.id) return;
        const exitOrderType = parentOrder.type === 'BUY' ? 'SELL' : 'BUY';
        const newOrders: Omit<Order, 'id'>[] = [];

        if (parentOrder.stop_loss_value) {
            newOrders.push({
                user_id: parentOrder.user_id, parent_order_id: parentOrder.id, type: exitOrderType,
                ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
                order_method: 'SL-M', trigger_price: parentOrder.stop_loss_value, product: parentOrder.product,
                is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
                exchange: parentOrder.exchange, order_type: `${parentOrder.product} SL-M`,
                limit_price: 0, filled_quantity: 0, ltp: parentOrder.ltp,
            });
        }

        if (parentOrder.target_value) {
            newOrders.push({
                user_id: parentOrder.user_id, parent_order_id: parentOrder.id, type: exitOrderType,
                ticker: parentOrder.ticker, quantity: parentOrder.quantity, status: 'Pending',
                order_method: 'LIMIT', limit_price: parentOrder.target_value, product: parentOrder.product,
                is_amo: false, timestamp: new Date().toISOString(), market: parentOrder.market,
                exchange: parentOrder.exchange, order_type: `${parentOrder.product} LIMIT`,
                filled_quantity: 0, ltp: parentOrder.ltp,
            });
        }
        
        if (newOrders.length > 0) {
            await supabase.from('orders').insert(newOrders);
        }
    };
    
    const cancelPeerBracketOrders = async (childOrder: Order) => {
        if (!childOrder.parent_order_id) return;
        const { data: peerOrders } = await supabase.from('orders').select('id')
            .eq('parent_order_id', childOrder.parent_order_id).eq('status', 'Pending').neq('id', childOrder.id);

        if (peerOrders && peerOrders.length > 0) {
            const idsToCancel = peerOrders.map(o => o.id);
            await supabase.from('orders').update({ status: 'Cancelled' }).in('id', idsToCancel);
        }
    };

    if (!executedOrderWithUpdate.parent_order_id) {
        await createBracketOrders(executedOrderWithUpdate);
    } else {
        await cancelPeerBracketOrders(executedOrderWithUpdate);
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
                const { data: finalCheckOrder } = await supabase.from('orders').select('*').eq('id', order.id).single();
                if (finalCheckOrder && finalCheckOrder.status === 'Pending') {
                   await executeOrder(finalCheckOrder, executionPrice);
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
