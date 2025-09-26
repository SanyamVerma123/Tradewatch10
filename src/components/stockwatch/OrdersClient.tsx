

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Order, Portfolio, Stock, Holding } from "@/lib/types";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { getStockData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";

export function OrdersClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currencySymbol } = useMarket();

  // Effect to fetch user and redirect if not logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (!sbUser) {
        // This navigation now happens safely after the initial render.
        router.replace('/');
      } else {
        setUser(sbUser);
      }
    };
    checkUser();
  }, [router]);

  // Effect to load orders and handle storage events once the user is confirmed
  useEffect(() => {
    if (!user) return;

    const fetchOrders = () => {
      const ordersKey = `orders_${user.id}`;
      try {
        const storedOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
        setOrders(storedOrders);
      } catch {
        setOrders([]);
      }
      setIsLoading(false);
    };

    fetchOrders();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `orders_${user.id}`) {
        fetchOrders();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);


  // Effect to update live prices for pending orders
  useEffect(() => {
    // Don't run interval until user and initial orders are loaded
    if (!user || isLoading) return;

    const updateLivePrices = async () => {
        const pending = orders.filter(o => o.status === 'Pending');
        if (pending.length === 0) return;

        const tickers = [...new Set(pending.map(o => o.ticker))];
        if (tickers.length === 0) return;

        try {
            const stockData = await getStockData(tickers);
            const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));
            
            // This functional update ensures we are working with the latest state
            setOrders(prevOrders => {
                let wasUpdated = false;
                const newOrders = prevOrders.map(order => {
                    if (order.status === 'Pending' && stockPriceMap.has(order.ticker)) {
                        const newLtp = stockPriceMap.get(order.ticker)!;
                        if (order.ltp !== newLtp) {
                            wasUpdated = true;
                            return { ...order, ltp: newLtp };
                        }
                    }
                    return order;
                });
                // Only return a new array if something actually changed
                return wasUpdated ? newOrders : prevOrders;
            });
        } catch (error) {
            console.error("Failed to fetch live prices for orders:", error);
        }
    };
    
    const interval = setInterval(updateLivePrices, 5000); 

    return () => clearInterval(interval);
  }, [user, isLoading, orders]);


  const handleEditClick = (order: Order) => {
    if (order.status === 'Pending') {
      const orderQueryParam = encodeURIComponent(JSON.stringify(order));
      router.push(`/trade/${encodeURIComponent(order.ticker)}?order=${orderQueryParam}`);
    }
  };

  if (isLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  const pendingOrders = orders.filter(o => o.status === 'Pending');
  const executedOrders = orders.filter(o => o.status === 'Executed');
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled');

  const filteredPendingOrders = pendingOrders.filter(
    (order) => order.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredExecutedOrders = executedOrders.filter(o => o.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCancelledOrders = cancelledOrders.filter(o => o.ticker.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="Pending">Pending ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="Executed">Executed ({executedOrders.length})</TabsTrigger>
          <TabsTrigger value="GTT">GTT</TabsTrigger>
        </TabsList>
        <div className="relative my-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
            placeholder="Search eg: infy, reliance"
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <TabsContent value="Pending">
          <div className="space-y-4">
            {filteredPendingOrders.length > 0 ? filteredPendingOrders.map((order) => {
              return (
              <Card key={order.id} onClick={() => handleEditClick(order)} className={order.status === 'Pending' ? 'cursor-pointer' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                        <span className={`font-bold ${order.type === 'BUY' ? 'text-blue-500' : 'text-red-500'}`}>{order.type}</span>
                        <span className="ml-2 text-muted-foreground">{order.filledQuantity}/{order.quantity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                        <span>{order.timestamp}</span>
                        {order.isAMO && <div className="text-primary font-semibold">AMO REQ...</div>}
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <div>
                        <p className="font-semibold">{order.ticker}</p>
                        <p className="text-xs text-muted-foreground">{order.exchange} {order.orderType}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold">{currencySymbol}{order.limitPrice.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">LTP {currencySymbol}{order.ltp.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}) : <div className="text-center py-10"><p className="text-muted-foreground">You have no pending orders.</p></div>}
          </div>
        </TabsContent>
        <TabsContent value="Executed">
        <div className="space-y-4">
            {filteredExecutedOrders.length > 0 ? filteredExecutedOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                        <span className={`font-bold ${order.type === 'BUY' ? 'text-blue-500' : 'text-red-500'}`}>{order.type}</span>
                        <span className="ml-2 text-green-500">{order.filledQuantity}/{order.quantity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                        <span>{order.executedAt ? new Date(order.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : order.timestamp}</span>
                         <span className="text-xs font-semibold text-green-600 ml-2">EXECUTED</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <div>
                        <p className="font-semibold">{order.ticker}</p>
                        <p className="text-xs text-muted-foreground">{order.exchange} {order.orderType}</p>
                    </div>
                     <div className="text-right">
                        <p className="font-semibold">Avg. {currencySymbol}{order.ltp.toFixed(2)}</p>
                        {order.realizedPnl !== undefined && (
                            <p className={cn("text-xs font-semibold", order.realizedPnl >= 0 ? "text-positive" : "text-destructive")}>
                                P&L: {order.realizedPnl >= 0 ? '+' : ''}{currencySymbol}{order.realizedPnl.toFixed(2)}
                            </p>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : <div className="text-center py-10"><p className="text-muted-foreground">You have no executed orders.</p></div>}
          </div>
          {filteredCancelledOrders.length > 0 && <h3 className="text-lg font-semibold my-4">Cancelled</h3>}
           <div className="space-y-4">
            {filteredCancelledOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                        <span className={`font-bold ${order.type === 'BUY' ? 'text-blue-500' : 'text-red-500'}`}>{order.type}</span>
                        <span className="ml-2 text-red-500">{order.filledQuantity}/{order.quantity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                        <span>{order.timestamp}</span>
                         <span className="text-xs font-semibold text-red-600 ml-2">CANCELLED</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <div>
                        <p className="font-semibold">{order.ticker}</p>
                        <p className="text-xs text-muted-foreground">{order.exchange} {order.orderType}</p>
                    </div>
                     <div className="text-right">
                        <p className="font-semibold">{currencySymbol}{order.limitPrice.toFixed(2)}</p>                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="GTT">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No GTT orders found.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
