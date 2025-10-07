
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, PieChart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMarketNews, getStockData } from "@/app/actions";
import type { NewsArticle, Order, Position } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useMarket, marketDetails } from "@/hooks/use-market";

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: User },
];

// Heuristic to check if market is open (9:15 AM to 3:30 PM India time on weekdays)
function isMarketOpen() {
    const now = new Date();
    const istOffset = 330; // 5.5 hours in minutes
    const utcOffset = now.getTimezoneOffset();
    const istTime = new Date(now.getTime() + (istOffset + utcOffset) * 60000);
    
    const day = istTime.getDay(); // Sunday = 0, Monday = 1, etc.
    if (day === 0 || day === 6) return false; // Weekend

    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    
    // Market is open between 9:15 AM and 3:30 PM
    if (hours > 9 || (hours === 9 && minutes >= 15)) {
        if (hours < 15 || (hours === 15 && minutes <= 30)) {
            return true;
        }
    }
    return false;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { market } = useMarket();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndCacheNews = useCallback(async (userId: string) => {
    // News caching is now handled by WatchlistDashboard, this can be simplified or removed
  }, [market]);

  const cancelOrder = useCallback(async (orderToCancel: Order, reason: string, userId: string) => {
    if (!userId) return;

    // Update order status in Supabase
    const { error } = await supabase
      .from('orders')
      .update({ status: 'Cancelled' })
      .eq('id', orderToCancel.id)
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error cancelling order', description: error.message });
      return;
    }

    if (orderToCancel.type === 'BUY' && orderToCancel.status === 'Pending') {
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds')
        .select('balance')
        .eq('user_id', userId)
        .eq('market', market)
        .single();
      
      if (fundsData && fundsData.balance !== undefined) {
        const tradeValue = orderToCancel.quantity * (orderToCancel.order_method === "MARKET" ? orderToCancel.ltp : orderToCancel.limit_price);
        const brokerage = Math.min(20, tradeValue * 0.0003);
        const totalCharges = brokerage;
        const approxMargin = orderToCancel.product === 'MIS' ? tradeValue / 5 : tradeValue;
        const blockedFunds = approxMargin + totalCharges;
        const newBalance = fundsData.balance + blockedFunds;
        
        await supabase.from('funds').update({ balance: newBalance }).eq('user_id', userId).eq('market', market);
      }
    }
    
    toast({
        variant: "destructive",
        title: "Order Cancelled",
        description: `${orderToCancel.ticker}: ${reason}`,
    });
  }, [toast, market]);


  const executeOrder = useCallback(async (orderToExecute: Order, ltp: number, userId: string) => {
    if (!userId) return false;
    
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderToExecute.id)
      .single();

    if (fetchError || !currentOrder || currentOrder.status !== 'Pending') {
      return false; // Order already processed or doesn't exist
    }

    const { data: fundsData, error: fundsError } = await supabase.from('funds').select('balance').eq('user_id', userId).eq('market', market).single();
    if (fundsError || !fundsData) return false;
    
    const product = orderToExecute.product || 'CNC';
    const finalTradeValue = orderToExecute.quantity * ltp;
    
    let realizedPnl: number | undefined = undefined;

    if (orderToExecute.type === 'SELL') {
        const { data: purchaseOrders, error: poError } = await supabase
            .from('orders')
            .select('quantity, limit_price')
            .eq('user_id', userId)
            .eq('market', market)
            .eq('ticker', orderToExecute.ticker)
            .eq('product', product)
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


    const brokerage = Math.min(20, finalTradeValue * 0.0003);
    const totalCharges = brokerage;
    
    const executedOrderUpdate: Partial<Order> = { status: 'Executed', filled_quantity: orderToExecute.quantity, ltp, executed_at: new Date().toISOString(), realized_pnl: realizedPnl };

    const { error: updateError } = await supabase.from('orders').update(executedOrderUpdate).eq('id', orderToExecute.id);
    if (updateError) return false;
    
    // For a BUY order, the funds were already blocked. No further action needed on funds.
    // For a SELL order, credit the funds to the user's account.
    if (orderToExecute.type === 'SELL') {
      let newBalance = fundsData.balance + (finalTradeValue - totalCharges);
      newBalance = Math.max(0, newBalance); // Ensure balance doesn't go negative
      await supabase.from('funds').update({ balance: newBalance }).eq('user_id', userId).eq('market', market);
    }
    
    toast({
        title: `Order Executed!`,
        description: `${orderToExecute.type} ${orderToExecute.quantity} ${orderToExecute.ticker} at ${marketDetails[market].symbol}${ltp.toFixed(2)}. Est. charges: ${marketDetails[market].symbol}${totalCharges.toFixed(2)}`,
    });
    return true;

  }, [toast, cancelOrder, market]);


  useEffect(() => {
    let sessionChecked = false;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      setIsLoading(false);
      sessionChecked = true;

      if (!loggedIn && pathname !== '/') {
        router.replace('/');
        return;
      }
    };

    checkSession();
    
    const checkPendingOrders = async () => {
        if(!sessionChecked) return;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: pendingOrders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('market', market)
          .eq('status', 'Pending');

        if (ordersError || !pendingOrders || pendingOrders.length === 0) return;

        const marketIsOpen = isMarketOpen();
        if (!marketIsOpen && !pendingOrders.some(o => o.is_amo)) return;
        
        try {
            const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
            if (tickers.length === 0) return;
            const stockData = await getStockData(tickers);
            
            const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));

            for (const order of pendingOrders) {
                const ltp = stockPriceMap.get(order.ticker);
                if (ltp === undefined) continue;

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
                    await executeOrder(order, executionPrice, user.id);
                }
            }
        } catch (error) {
            console.error("Error in checkPendingOrders:", error);
        }
    };
    
    // Set up global order execution loop
    const orderInterval = setInterval(checkPendingOrders, 5000);


    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
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

  }, [pathname, router, fetchAndCacheNews, executeOrder, cancelOrder, market]);

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
