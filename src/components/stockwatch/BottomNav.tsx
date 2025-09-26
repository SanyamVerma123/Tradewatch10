

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
import { useMarket } from "@/hooks/use-market";

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: User },
];

async function showDelayedFundNotification() {
    if (!('serviceWorker' in navigator) || !window.Notification || Notification.permission !== 'granted') {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("Funds Credited!", {
        body: "Your starting fund of ₹5,00,000 has been credited to your account.",
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
      });
    } catch (err) {
      console.error('Error showing fund notification:', err);
    }
}

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
    const newsCacheKey = `newsCache_${userId}_${market}`;
    const cachedNewsData = localStorage.getItem(newsCacheKey);
    let shouldFetch = true;

    if (cachedNewsData) {
        const { timestamp } = JSON.parse(cachedNewsData);
        const lastFetch = new Date(timestamp);
        const now = new Date();
        const oneHour = 60 * 60 * 1000;
        if (now.getTime() - lastFetch.getTime() < oneHour) {
            shouldFetch = false;
        }
    }

    if (shouldFetch) {
        const liveNews = await getMarketNews();
        if (liveNews) {
            const articles: NewsArticle[] = liveNews.map((article: any) => ({
                id: article.id,
                headline: article.headline,
                source: article.source,
                time: article.time,
                image: article.image,
                url: article.url,
            }));

            const today = new Date().toDateString();
            const newsCache = {
                timestamp: new Date().toISOString(),
                date: today,
                articles: articles,
            };
            localStorage.setItem(newsCacheKey, JSON.stringify(newsCache));
            // Manually trigger a storage event so other tabs get the new data
            window.dispatchEvent(new StorageEvent('storage', {
                key: newsCacheKey,
                newValue: JSON.stringify(newsCache),
            }));
        }
    }
  }, [market]);

  const cancelOrder = useCallback((orderToCancel: Order, reason: string, userId: string) => {
    if (!userId) return;
    const ordersKey = `orders_${userId}_${market}`;
    const allOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    
    const updatedOrders = allOrders.map((o: Order) => 
        o.id === orderToCancel.id ? { ...o, status: 'Cancelled' as const } : o
    );
    
    if (orderToCancel.type === 'BUY' && orderToCancel.status === 'Pending') {
        const fundsKey = `funds_${userId}_${market}`;
        const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
        
        if (fundsData.balance !== undefined) {
            const tradeValue = orderToCancel.quantity * (orderToCancel.orderMethod === "MARKET" ? orderToCancel.ltp : orderToCancel.limitPrice);
            const brokerage = Math.min(20, tradeValue * 0.0003);
            const totalCharges = brokerage + (tradeValue * 0.000345);
            const approxMargin = orderToCancel.product === 'MIS' ? tradeValue / 5 : tradeValue;
            const blockedFunds = approxMargin + totalCharges;

            const newBalance = fundsData.balance + blockedFunds;
            localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: newBalance }));
             window.dispatchEvent(new StorageEvent('storage', { key: fundsKey }));
        }
    }
    
    localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
    window.dispatchEvent(new StorageEvent('storage', { key: ordersKey }));
    
    toast({
        variant: "destructive",
        title: "Order Cancelled",
        description: `${orderToCancel.ticker}: ${reason}`,
    });
  }, [toast, market]);


  const executeOrder = useCallback((orderToExecute: Order, ltp: number, userId: string) => {
    if (!userId) return false;

    const ordersKey = `orders_${userId}_${market}`;
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const orderIndex = allOrders.findIndex(o => o.id === orderToExecute.id);
    if (orderIndex === -1 || allOrders[orderIndex].status !== 'Pending') {
        return false;
    }
    
    const fundsKey = `funds_${userId}_${market}`;
    const product = orderToExecute.product || 'CNC';
    const finalTradeValue = orderToExecute.quantity * ltp;
    const isIntradayTrade = product === 'MIS';
    
    const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
    const approxMargin = isIntradayTrade ? finalTradeValue / 5 : finalTradeValue;

    if (orderToExecute.type === 'BUY' && fundsData.balance < 0) { 
        cancelOrder(orderToExecute, `Insufficient funds. Required margin: ~₹${approxMargin.toFixed(2)}`, userId);
        return false;
    }
    
    // Calculate realized PnL for SELL orders and BUY-to-cover-short orders
    let realizedPnl: number | undefined = undefined;
    if (orderToExecute.type === 'SELL' || (orderToExecute.type === 'BUY' && orderToExecute.isExit)) {
      // Find the position this order is closing/reducing
      const isToday = (d: Date) => { const t = new Date(); return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); };
      const executedOrdersToday = allOrders.filter((o: Order) => o.status === 'Executed' && o.executedAt && isToday(new Date(o.executedAt)));
      const positionMap: { [compositeKey: string]: Position } = {};
      
      for (const order of executedOrdersToday) {
        const pKey = `${order.ticker}-${order.product}`;
        let p = positionMap[pKey];
        if (!p) {
             p = { id: `p-${pKey}`, ticker: order.ticker, product: order.product!, quantity: 0, avgPrice: 0, ltp: 0, pnl: 0, investedValue: 0, dayChange: 0, dayChangePercent: 0, pnlPercent: 0, type: 'BUY' };
             positionMap[pKey] = p;
        }
        const tradeSign = order.type === 'BUY' ? 1 : -1;
        const currentNetQty = p.quantity;
        if(Math.sign(tradeSign) === Math.sign(currentNetQty) || currentNetQty === 0) {
            const newTotalValue = (p.avgPrice * Math.abs(currentNetQty)) + (order.ltp * order.quantity);
            p.quantity += order.quantity * tradeSign;
            p.avgPrice = Math.abs(p.quantity) > 0 ? newTotalValue / Math.abs(p.quantity) : 0;
        } else {
            p.quantity += order.quantity * tradeSign;
            if (Math.abs(p.quantity) < 0.001) p.avgPrice = 0;
        }
      }
      
      const posKey = `${orderToExecute.ticker}-${orderToExecute.product}`;
      const relevantPosition = positionMap[posKey];
      const avgPrice = relevantPosition ? relevantPosition.avgPrice : 0;
      
      if (avgPrice > 0) {
        if (orderToExecute.type === 'SELL') { // Selling a long position
          realizedPnl = (ltp - avgPrice) * orderToExecute.quantity;
        } else { // Buying to cover a short position
          realizedPnl = (avgPrice - ltp) * orderToExecute.quantity;
        }
      }
    }

    const executedOrder: Order = { ...orderToExecute, status: 'Executed', filledQuantity: orderToExecute.quantity, ltp, executedAt: new Date().toISOString(), realizedPnl };
    allOrders[orderIndex] = executedOrder;

    const sttRate = (product === 'CNC' && executedOrder.type === 'SELL') ? 0.001 : (isIntradayTrade && executedOrder.type === 'SELL' ? 0.00025 : 0);
    const stt = finalTradeValue * sttRate;
    const brokerage = Math.min(20, finalTradeValue * 0.0003);
    const otherCharges = finalTradeValue * 0.000345;
    const totalCharges = brokerage + stt + otherCharges;
    
    if (fundsData.balance !== undefined && executedOrder.type === 'SELL') {
      let newBalance = fundsData.balance + (finalTradeValue - totalCharges);
      newBalance = Math.max(0, newBalance);
      localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: newBalance }));
      window.dispatchEvent(new StorageEvent('storage', { key: fundsKey }));
    }
    
    localStorage.setItem(ordersKey, JSON.stringify(allOrders));
    window.dispatchEvent(new StorageEvent('storage', { key: ordersKey }));

    toast({
        title: `Order Executed!`,
        description: `${executedOrder.type} ${executedOrder.quantity} ${executedOrder.ticker} at ₹${ltp.toFixed(2)}. Est. charges: ₹${totalCharges.toFixed(2)}`,
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
      
      if (loggedIn && session.user) {
        fetchAndCacheNews(session.user.id);
        
        const notifFlag = `postLoginFundNotification_${session.user.id}_${market}`;
        if (localStorage.getItem(notifFlag) === 'true') {
            localStorage.removeItem(notifFlag);
            
            setTimeout(() => {
                const fundsKey = `funds_${session.user!.id}_${market}`;
                const fundsData = localStorage.getItem(fundsKey);
                if (!fundsData) {
                    const initialFunds = { balance: 500000, canAddMore: true, lastProfitCheck: 0 };
                    localStorage.setItem(fundsKey, JSON.stringify(initialFunds));
                }
                showDelayedFundNotification();
            }, 60000);
        }
      }
    };

    checkSession();
    
    const checkPendingOrders = async () => {
        if(!sessionChecked) return;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const ordersKey = `orders_${user.id}_${market}`;
        const currentOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
        const pendingOrders = currentOrders.filter((o: Order) => o.status === 'Pending');

        if (pendingOrders.length === 0) return;

        const marketIsOpen = isMarketOpen();
        if (!marketIsOpen) return;
        
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

                if (order.isAMO) { shouldExecute = true; } 
                else if (order.orderMethod === "MARKET") { shouldExecute = true; }
                else if (order.orderMethod === "LIMIT") {
                    if ((order.type === 'BUY' && ltp <= order.limitPrice) || (order.type === 'SELL' && ltp >= order.limitPrice)) {
                        shouldExecute = true;
                        executionPrice = order.limitPrice;
                    }
                } 
                else if (order.orderMethod === "SL") {
                    if (order.triggerPrice && ((order.type === 'BUY' && ltp >= order.triggerPrice) || (order.type === 'SELL' && ltp <= order.triggerPrice))) {
                        if ((order.type === 'BUY' && ltp <= order.limitPrice) || (order.type === 'SELL' && ltp >= order.limitPrice)) {
                           shouldExecute = true;
                           executionPrice = order.limitPrice;
                        }
                    }
                } 
                else if (order.orderMethod === "SL-M") {
                    if (order.triggerPrice && ((order.type === 'BUY' && ltp >= order.triggerPrice) || (order.type === 'SELL' && ltp <= order.triggerPrice))) {
                        shouldExecute = true;
                    }
                }
                
                if (shouldExecute) {
                    executeOrder(order, executionPrice, user.id);
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
    
    const newsInterval = setInterval(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchAndCacheNews(session.user.id);
            }
        });
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(newsInterval);
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

    

    