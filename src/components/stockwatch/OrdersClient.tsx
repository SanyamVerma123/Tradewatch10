
"use client";

import { useState, useEffect, useCallback } from "react";
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

const isToday = (someDate: Date) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        someDate.getFullYear() === today.getFullYear();
};

export function OrdersClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
      } else {
        setUser(sbUser);
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [router]);

  const cancelOrder = useCallback((orderToCancel: Order, reason: string) => {
    if (!user) return;
    const ordersKey = `orders_${user.id}`;
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const updatedOrders = allOrders.map(o => o.id === orderToCancel.id ? { ...o, status: 'Cancelled' } : o);
    localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
    setOrders(updatedOrders);
    toast({
        variant: "destructive",
        title: "Order Cancelled",
        description: `${orderToCancel.ticker}: ${reason}`,
    });
  }, [toast, user]);


  const executeOrder = useCallback((orderToExecute: Order, ltp: number) => {
    if (!user) return;
    const product = orderToExecute.product || 'CNC';
    const finalTradeValue = orderToExecute.quantity * ltp;
    
    // Correct tax simulation
    const isIntradayTrade = product === 'MIS';
    const sttRate = isIntradayTrade && orderToExecute.type === 'SELL' ? 0.00025 : ((orderToExecute.product === 'CNC' && orderToExecute.type === 'SELL') ? 0.001 : 0);
    const stt = finalTradeValue * sttRate;
    const brokerage = Math.min(20, finalTradeValue * 0.0003);
    const totalCharges = brokerage + stt + (finalTradeValue * 0.000345); // Other minor charges


    const fundsKey = `funds_${user.id}`;
    const ordersKey = `orders_${user.id}`;
    const portfolioKey = `portfolioData_${user.id}`;
    
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    let portfolio: Portfolio = JSON.parse(localStorage.getItem(portfolioKey) || '{ "holdings": [], "positions": [] }');

    // Final funds check before execution
    const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
    if (orderToExecute.type === 'BUY' && fundsData.balance < finalTradeValue + totalCharges) {
        cancelOrder(orderToExecute, `Insufficient funds. Required: ₹${(finalTradeValue + totalCharges).toFixed(2)}`);
        return;
    }
    
    let realizedPnl: number | undefined = undefined;
    if (orderToExecute.type === 'SELL') {
      const compositeKey = `${orderToExecute.ticker}-${product}`;
      const position = (portfolio.positions || []).find(p => p.id === `pos-${compositeKey}`);
      const holding = portfolio.holdings.find(h => h.ticker === orderToExecute.ticker);

      let buyPrice = 0;
      if (orderToExecute.isSellFromHolding && holding) {
        buyPrice = holding.avgPrice;
      } else if (position) {
        buyPrice = position.avgPrice;
      } else {
        // Fallback for older trades before positions were tracked this way
        const relatedBuyOrders = allOrders
            .filter(o => o.status === 'Executed' && o.type === 'BUY' && o.ticker === orderToExecute.ticker)
            .sort((a, b) => new Date(a.executedAt!).getTime() - new Date(b.executedAt!).getTime());
         if (relatedBuyOrders.length > 0) {
            const totalValue = relatedBuyOrders.reduce((acc, o) => acc + (o.ltp * o.quantity), 0);
            const totalQty = relatedBuyOrders.reduce((acc, o) => acc + o.quantity, 0);
            if(totalQty > 0) buyPrice = totalValue / totalQty;
         }
      }
      
      if (buyPrice > 0) {
        realizedPnl = (ltp - buyPrice) * orderToExecute.quantity;
      }
    }


    const executedOrder: Order = { ...orderToExecute, status: 'Executed', filledQuantity: orderToExecute.quantity, ltp, executedAt: new Date().toISOString(), realizedPnl };

    // Update orders in state and local storage
    const existingOrderIndex = allOrders.findIndex(o => o.id === executedOrder.id);
    if (existingOrderIndex > -1) {
      allOrders[existingOrderIndex] = executedOrder;
    } else {
      allOrders.unshift(executedOrder);
    }
    localStorage.setItem(ordersKey, JSON.stringify(allOrders));
    setOrders(allOrders);

    // Simulate Tax & Fund deduction/addition
    if (fundsData.balance !== undefined) {
      let newBalance = executedOrder.type === 'BUY' 
        ? fundsData.balance - finalTradeValue
        : fundsData.balance + finalTradeValue;
        
      newBalance -= totalCharges; // Always deduct charges
      newBalance = Math.max(0, newBalance); // Ensure balance doesn't go below zero

      localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: newBalance }));
    }
    
    // Update holdings for non-today CNC trades
    if (product === 'CNC' && !isToday(new Date(executedOrder.executedAt!))) {
        let newHoldings = [...(portfolio.holdings || [])];
        const holdingIndex = newHoldings.findIndex(h => h.ticker === executedOrder.ticker);

        if (executedOrder.type === 'BUY') {
             if (holdingIndex > -1) {
                const existingHolding = newHoldings[holdingIndex];
                const totalQuantity = existingHolding.quantity + executedOrder.quantity;
                const newAvgPrice = ((existingHolding.avgPrice * existingHolding.quantity) + (ltp * executedOrder.quantity)) / totalQuantity;
                newHoldings[holdingIndex] = { ...existingHolding, quantity: totalQuantity, avgPrice: newAvgPrice, investedValue: newAvgPrice * totalQuantity };
            } else {
                newHoldings.push({
                    id: `holding-${Date.now()}`,
                    ticker: executedOrder.ticker,
                    quantity: executedOrder.quantity,
                    avgPrice: ltp,
                    ltp: ltp,
                    pnl: 0,
                    pnlPercent: 0,
                    dayChange: 0, 
                    dayChangePercent: 0,
                    investedValue: ltp * executedOrder.quantity,
                });
            }
        } else { // SELL
            if (holdingIndex > -1) {
                const existingHolding = newHoldings[holdingIndex];
                const updatedQuantity = existingHolding.quantity - executedOrder.quantity;
                if (updatedQuantity < 0.001) {
                    newHoldings.splice(holdingIndex, 1);
                } else {
                    newHoldings[holdingIndex] = { ...existingHolding, quantity: updatedQuantity, investedValue: existingHolding.avgPrice * updatedQuantity };
                }
            }
        }
        localStorage.setItem(portfolioKey, JSON.stringify({ ...portfolio, holdings: newHoldings }));
    }
    
    toast({
        title: `Order Executed!`,
        description: `${executedOrder.type} ${executedOrder.quantity} ${executedOrder.ticker} at ₹${ltp.toFixed(2)}. Est. charges: ₹${totalCharges.toFixed(2)}`,
    });

  }, [toast, cancelOrder, user]);


  useEffect(() => {
    if (!user) return;
    const ordersKey = `orders_${user.id}`;

    const fetchOrdersDataAndCheckPending = async () => {
        const storedOrdersText = localStorage.getItem(ordersKey) || '[]';
        let storedOrders: Order[];
        try {
            storedOrders = JSON.parse(storedOrdersText);
        } catch {
            storedOrders = [];
        }
        
        const pendingOrders = storedOrders.filter((o:Order) => o.status === 'Pending');

        if (pendingOrders.length === 0) {
             if(JSON.stringify(orders) !== storedOrdersText) {
                setOrders(storedOrders);
            }
            return;
        }

        const marketIsOpen = isMarketOpen();
        if (!marketIsOpen) {
            if(JSON.stringify(orders) !== storedOrdersText) {
                setOrders(storedOrders);
            }
            return;
        }

        const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
        const stockData = await getStockData(tickers);
        const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));

        let ordersWereExecuted = false;
        pendingOrders.forEach((order: Order) => {
            const ltp = stockPriceMap.get(order.ticker);
            if (ltp === undefined) return;

            let shouldExecute = false;
            // Default execution price is LTP, which is correct for MARKET, SL-M, and triggered SL orders.
            let executionPrice = ltp; 

            if (order.isAMO) {
                shouldExecute = true; 
            } else if (order.orderMethod === "LIMIT") {
                if (order.type === 'BUY' && ltp <= order.limitPrice) {
                    shouldExecute = true;
                    executionPrice = Math.min(order.limitPrice, ltp); // Get the best price
                } else if (order.type === 'SELL' && ltp >= order.limitPrice) {
                    shouldExecute = true;
                    executionPrice = Math.max(order.limitPrice, ltp); // Get the best price
                }
            } else if(order.orderMethod === "SL") {
                 // Stop-Loss Limit: trigger activates a limit order
                 if (order.triggerPrice && ((order.type === 'BUY' && ltp >= order.triggerPrice) || (order.type === 'SELL' && ltp <= order.triggerPrice))) {
                    // SL order becomes a limit order once triggered
                    if (order.type === 'BUY' && ltp <= order.limitPrice) {
                        shouldExecute = true;
                        executionPrice = Math.min(order.limitPrice, ltp);
                    } else if (order.type === 'SELL' && ltp >= order.limitPrice) {
                        shouldExecute = true;
                        executionPrice = Math.max(order.limitPrice, ltp);
                    }
                 }
            } else if(order.orderMethod === "SL-M") {
                 // Stop-Loss Market: trigger activates a market order
                if (order.triggerPrice && ((order.type === 'BUY' && ltp >= order.triggerPrice) || (order.type === 'SELL' && ltp <= order.triggerPrice))) {
                    shouldExecute = true;
                    // executionPrice is already LTP
                }
            } else if (order.orderMethod === "MARKET") {
                shouldExecute = true; // Market orders execute at LTP
            }
            
            if (shouldExecute) {
                executeOrder(order, executionPrice);
                ordersWereExecuted = true;
            }
        });
        
        if (!ordersWereExecuted) {
            const ordersWithFreshLtp = storedOrders.map((o: Order) => {
                if (o.status === 'Pending') {
                    return {
                        ...o,
                        ltp: stockPriceMap.get(o.ticker) || o.ltp,
                    }
                }
                return o;
            });
            if (JSON.stringify(orders) !== JSON.stringify(ordersWithFreshLtp)) {
                setOrders(ordersWithFreshLtp);
            }
        }
    };

    fetchOrdersDataAndCheckPending();
    const interval = setInterval(fetchOrdersDataAndCheckPending, 5000);

    return () => clearInterval(interval);
  }, [executeOrder, orders, cancelOrder, user]);

  const handleEditClick = (order: Order) => {
    if (order.status === 'Pending') {
      const orderQueryParam = encodeURIComponent(JSON.stringify(order));
      router.push(`/trade/${encodeURIComponent(order.ticker)}?order=${orderQueryParam}`);
    }
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const filteredPendingOrders = orders.filter(
    (order) =>
      order.status === 'Pending' &&
      (order.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (order.exchange && order.exchange.toLowerCase().includes(searchTerm.toLowerCase())))
  );
  
  const filteredExecutedOrders = orders.filter(o => o.status === 'Executed' && (o.ticker.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredCancelledOrders = orders.filter(o => o.status === 'Cancelled' && (o.ticker.toLowerCase().includes(searchTerm.toLowerCase())));

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
          <TabsTrigger value="Pending">Pending</TabsTrigger>
          <TabsTrigger value="Executed">Executed</TabsTrigger>
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
            {filteredPendingOrders.length > 0 ? filteredPendingOrders.map((order) => (
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
                        <p className="font-semibold">₹{order.limitPrice.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">LTP ₹{order.ltp.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : <div className="text-center py-10"><p className="text-muted-foreground">You have no pending orders.</p></div>}
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
                        <span>{new Date(order.executedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         <span className="text-xs font-semibold text-green-600 ml-2">EXECUTED</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <div>
                        <p className="font-semibold">{order.ticker}</p>
                        <p className="text-xs text-muted-foreground">{order.exchange} {order.orderType}</p>
                    </div>
                     <div className="text-right">
                        <p className="font-semibold">Avg. ₹{order.ltp.toFixed(2)}</p>
                        {order.realizedPnl !== undefined && (
                            <p className={cn("text-xs font-semibold", order.realizedPnl >= 0 ? "text-positive" : "text-destructive")}>
                                P&L: {order.realizedPnl >= 0 ? '+' : ''}₹{order.realizedPnl.toFixed(2)}
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
                        <p className="font-semibold">₹{order.limitPrice.toFixed(2)}</p>                    </div>
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

    

    