

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order, Portfolio, Stock } from "@/lib/types";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal } from "lucide-react";
import { getStockData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

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

export function OrdersClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  const executeOrder = useCallback((orderToExecute: Order, ltp: number) => {
    // This is a simulation. In a real app, this would be handled by a backend.
    const executedOrder: Order = { ...orderToExecute, status: 'Executed', filledQuantity: orderToExecute.quantity, ltp, executedAt: new Date().toISOString() };

    // Update orders in state and local storage
    let allOrders: Order[] = JSON.parse(localStorage.getItem('orders') || '[]');
    // If the order was pending, update it. If it was a new market order, add it.
    const existingOrderIndex = allOrders.findIndex(o => o.id === executedOrder.id);
    if (existingOrderIndex > -1) {
      allOrders[existingOrderIndex] = executedOrder;
    } else {
      allOrders = [executedOrder, ...allOrders];
    }
    localStorage.setItem('orders', JSON.stringify(allOrders));
    setOrders(allOrders);

    // Simulate Tax & Fund deduction/addition
    const finalTradeValue = executedOrder.quantity * executedOrder.ltp;
    const brokerage = Math.min(20, finalTradeValue * 0.0005);
    const product = executedOrder.product || 'CNC';
    const stt = executedOrder.type === 'BUY' ? 0 : product === 'MIS' ? finalTradeValue * 0.00025 : finalTradeValue * 0.001;
    const totalCharges = brokerage + stt + (finalTradeValue * 0.000345); // Other minor charges
    
    const fundsData = JSON.parse(localStorage.getItem('funds') || '{}');
    if (fundsData.balance) {
      const newBalance = executedOrder.type === 'BUY' ? fundsData.balance - finalTradeValue - totalCharges : fundsData.balance + finalTradeValue - totalCharges;
      localStorage.setItem('funds', JSON.stringify({ ...fundsData, balance: newBalance }));
    }
    
    // Update portfolio only for CNC (delivery) orders
    if (product === 'CNC') {
        const portfolioData: Portfolio = JSON.parse(localStorage.getItem('portfolioData') || JSON.stringify({ holdings: [] }));
        let newHoldings = [...(portfolioData.holdings || [])];
        const holdingIndex = newHoldings.findIndex(h => h.ticker === executedOrder.ticker);

        if (executedOrder.type === 'BUY') {
            if (holdingIndex > -1) {
                const existingHolding = newHoldings[holdingIndex];
                const totalQuantity = existingHolding.quantity + executedOrder.quantity;
                const newAvgPrice = ((existingHolding.avgPrice * existingHolding.quantity) + (executedOrder.ltp * executedOrder.quantity)) / totalQuantity;
                newHoldings[holdingIndex] = { ...existingHolding, quantity: totalQuantity, avgPrice: newAvgPrice };
            } else {
                newHoldings.push({
                    id: `holding-${Date.now()}`,
                    ticker: executedOrder.ticker,
                    quantity: executedOrder.quantity,
                    avgPrice: executedOrder.ltp,
                    ltp: executedOrder.ltp,
                    pnl: 0,
                    pnlPercent: 0,
                    dayChange: 0, 
                    dayChangePercent: 0,
                    investedValue: executedOrder.ltp * executedOrder.quantity,
                });
            }
        } else { // SELL
            if (holdingIndex > -1) {
                const existingHolding = newHoldings[holdingIndex];
                const updatedQuantity = existingHolding.quantity - executedOrder.quantity;
                if (updatedQuantity <= 0) {
                    // Remove the holding if all shares are sold
                    newHoldings.splice(holdingIndex, 1);
                } else {
                    // Otherwise, just update the quantity
                    newHoldings[holdingIndex] = { ...existingHolding, quantity: updatedQuantity };
                }
            }
        }
        const newPortfolioData = { ...portfolioData, holdings: newHoldings };
        localStorage.setItem('portfolioData', JSON.stringify(newPortfolioData));
    }
    
    toast({
        title: `Order Executed!`,
        description: `${executedOrder.type} ${executedOrder.quantity} ${executedOrder.ticker} at ₹${ltp.toFixed(2)}. Est. charges: ₹${totalCharges.toFixed(2)}`,
    });

  }, [toast]);


  useEffect(() => {
    const fetchOrdersDataAndCheckPending = async () => {
        const storedOrdersText = localStorage.getItem('orders') || '[]';
        const storedOrders = JSON.parse(storedOrdersText);
        
        const pendingOrders = storedOrders.filter((o:Order) => o.status === 'Pending');

        if (pendingOrders.length === 0) {
            // Still update the LTP for all orders if the state is not up to date
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
            // AMOs execute at market open price
            if (order.isAMO) {
                shouldExecute = true; 
            } else if (order.orderMethod === "LIMIT") {
                if (order.type === 'BUY' && ltp <= order.limitPrice) {
                    shouldExecute = true;
                } else if (order.type === 'SELL' && ltp >= order.limitPrice) {
                    shouldExecute = true;
                }
            } else if(order.orderMethod === "SL" || order.orderMethod === "SL-M") {
                 if (order.triggerPrice && order.type === 'BUY' && ltp >= order.triggerPrice) {
                    shouldExecute = true;
                } else if (order.triggerPrice && order.type === 'SELL' && ltp <= order.triggerPrice) {
                    shouldExecute = true;
                }
            }
            
            if (shouldExecute) {
                // For LIMIT orders, execution price is the limit price. For SL-M, it's LTP. For SL, it should be the limit price if specified, but we'll use LTP for a more realistic fill simulation post-trigger.
                const executionPrice = order.orderMethod === "LIMIT" ? order.limitPrice : ltp;
                executeOrder(order, executionPrice);
                ordersWereExecuted = true;
            }
        });
        
        // If no orders were executed, we might still need to update the LTP for pending orders.
        if (!ordersWereExecuted) {
            const ordersWithFreshLtp = storedOrders.map((o: Order) => ({
                ...o,
                ltp: stockPriceMap.get(o.ticker) || o.ltp,
            }));
            if (JSON.stringify(orders) !== JSON.stringify(ordersWithFreshLtp)) {
                setOrders(ordersWithFreshLtp);
            }
        }
    };

    fetchOrdersDataAndCheckPending();
    const interval = setInterval(fetchOrdersDataAndCheckPending, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [executeOrder, orders]);

  const handleEditClick = (order: Order) => {
    if (order.status === 'Pending') {
      const orderQueryParam = encodeURIComponent(JSON.stringify(order));
      router.push(`/trade/${encodeURIComponent(order.ticker)}?order=${orderQueryParam}`);
    }
  };

  const filteredPendingOrders = orders.filter(
    (order) =>
      order.status === 'Pending' &&
      (order.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (order.exchange && order.exchange.toLowerCase().includes(searchTerm.toLowerCase())))
  );
  
  const filteredExecutedOrders = orders.filter(o => o.status === 'Executed' && (o.ticker.toLowerCase().includes(searchTerm.toLowerCase())));

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
                        <span>{order.timestamp}</span>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : <div className="text-center py-10"><p className="text-muted-foreground">You have no executed orders.</p></div>}
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

    
