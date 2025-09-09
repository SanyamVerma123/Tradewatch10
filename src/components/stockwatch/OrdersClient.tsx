
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
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();

    if (day > 0 && day < 6) { // Monday to Friday
        if (hour > 9 || (hour === 9 && minute >= 15)) {
            if (hour < 15 || (hour === 15 && minute <= 30)) {
                return true;
            }
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

  const executeOrder = useCallback((order: Order, ltp: number) => {
    // This is a simulation. In a real app, this would be handled by a backend.
    const executedOrder = { ...order, status: 'Executed' as const, filledQuantity: order.quantity, ltp: ltp };
    
    // Update orders in state and local storage
    setOrders(prevOrders => {
        const updated = prevOrders.map(o => o.id === executedOrder.id ? executedOrder : o);
        localStorage.setItem('orders', JSON.stringify(updated));
        return updated;
    });

    // Simulate Tax & Fund deduction/addition
    const finalTradeValue = executedOrder.quantity * executedOrder.ltp;
    const brokerage = Math.min(20, finalTradeValue * 0.0005);
    const product = executedOrder.orderType.split(' ')[0];
    const stt = executedOrder.type === 'BUY' ? 0 : product === 'MIS' ? finalTradeValue * 0.00025 : finalTradeValue * 0.001;
    const totalCharges = brokerage + stt + (finalTradeValue * 0.000345); // Other minor charges
    
    const fundsData = JSON.parse(localStorage.getItem('funds') || '{}');
    const newBalance = executedOrder.type === 'BUY' ? fundsData.balance - finalTradeValue - totalCharges : fundsData.balance + finalTradeValue - totalCharges;
    localStorage.setItem('funds', JSON.stringify({ ...fundsData, balance: newBalance }));
    
    // Update portfolio
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
                dayChange: 0, // This would ideally come from getStockData
                dayChangePercent: 0, // This would ideally come from getStockData
                investedValue: executedOrder.ltp * executedOrder.quantity,
            });
        }
    } else { // SELL
        if (holdingIndex > -1) {
            const existingHolding = newHoldings[holdingIndex];
            existingHolding.quantity -= executedOrder.quantity;
            if (existingHolding.quantity <= 0) {
                newHoldings.splice(holdingIndex, 1);
            }
        }
    }
    const newPortfolioData = { ...portfolioData, holdings: newHoldings };
    localStorage.setItem('portfolioData', JSON.stringify(newPortfolioData));
    
    toast({
        title: `Order Executed!`,
        description: `${executedOrder.type} ${executedOrder.quantity} ${executedOrder.ticker} at ₹${ltp.toFixed(2)}. Est. charges: ₹${totalCharges.toFixed(2)}`,
    });

  }, [toast, router]);


  useEffect(() => {
    const fetchOrdersDataAndCheckPending = async () => {
        const storedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        const pendingOrders = storedOrders.filter((o:Order) => o.status === 'Pending');

        if (pendingOrders.length === 0) {
            // Still update the LTP for all orders
            const allTickers = [...new Set(storedOrders.map((o:Order) => o.ticker))];
            if (allTickers.length > 0) {
                const stockData = await getStockData(allTickers);
                const ltpMap = new Map(stockData.map(s => [s.ticker, s.price]));
                const ordersWithFreshLtp = storedOrders.map((o: Order) => ({...o, ltp: ltpMap.get(o.ticker) || o.ltp}));
                setOrders(ordersWithFreshLtp);
            } else {
                 setOrders(storedOrders);
            }
            return;
        }

        const marketIsOpen = isMarketOpen();
        if (!marketIsOpen) {
            setOrders(storedOrders);
            return;
        }

        const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
        const stockData = await getStockData(tickers);
        const stockPriceMap = new Map(stockData.map(s => [s.ticker, s.price]));

        pendingOrders.forEach((order: Order) => {
            const ltp = stockPriceMap.get(order.ticker);
            if (ltp === undefined) return;

            let shouldExecute = false;
            if (order.orderType.includes("MARKET") && order.isAMO) {
                shouldExecute = true; 
            } else if (order.orderType.includes("LIMIT")) {
                if (order.type === 'BUY' && ltp <= order.limitPrice) {
                    shouldExecute = true;
                } else if (order.type === 'SELL' && ltp >= order.limitPrice) {
                    shouldExecute = true;
                }
            } else if(order.orderType.includes("SL")) { // SL and SL-M
                 if (order.type === 'BUY' && ltp >= order.triggerPrice!) {
                    shouldExecute = true;
                } else if (order.type === 'SELL' && ltp <= order.triggerPrice!) {
                    shouldExecute = true;
                }
            }
            
            if (shouldExecute) {
                 // For SL-Limit orders, the actual execution price is the limit price. For others, it's LTP.
                const executionPrice = order.orderType === "SL" ? order.limitPrice : ltp;
                executeOrder(order, executionPrice);
            }
        });
        
        // Update LTP for all orders after potential executions
        const latestOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        const updatedOrdersWithLtp = latestOrders.map((o: Order) => ({...o, ltp: stockPriceMap.get(o.ticker) || o.ltp}));
        // Only update state if the data has actually changed to prevent infinite loops
        if(JSON.stringify(orders) !== JSON.stringify(updatedOrdersWithLtp)){
            setOrders(updatedOrdersWithLtp);
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

  const filteredOrders = orders.filter(
    (order) =>
      order.status === activeTab &&
      (order.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (order.exchange && order.exchange.toLowerCase().includes(searchTerm.toLowerCase())))
  );
  
  const executedOrders = orders.filter(o => o.status === 'Executed');

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
            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
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
            {executedOrders.length > 0 ? executedOrders.map((order) => (
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
                        <p className="font-semibold">Avg. ₹{order.limitPrice.toFixed(2)}</p>
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
