
"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/lib/types";
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

export function OrdersClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const storedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    setOrders(storedOrders);
  }, []);

  const executeOrder = (order: Order) => {
    // This is a simulation. In a real app, this would be handled by a backend.
    const updatedOrders = orders.map(o => 
      o.id === order.id ? { ...o, status: 'Executed' as const, filledQuantity: o.quantity } : o
    );
    setOrders(updatedOrders);
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    
    // In a real app you would also handle fund deduction and portfolio updates here
    // For simplicity, we are handling that on the TradeClient side for immediate feedback.
    
    toast({
        title: `Order Executed!`,
        description: `${order.type} ${order.quantity} ${order.ticker}.`
    });
  }


  useEffect(() => {
    const fetchOrdersDataAndCheckPending = async () => {
        const storedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        const pendingOrders = storedOrders.filter((o:Order) => o.status === 'Pending');

        if (pendingOrders.length === 0) {
            setOrders(storedOrders);
            return;
        }

        const tickers = [...new Set(pendingOrders.map((o: Order) => o.ticker))];
        const stockData = await getStockData(tickers);
        
        const updatedOrders = storedOrders.map((order: Order) => {
            const relevantStock = stockData.find(s => s.ticker === order.ticker);
            const ltp = relevantStock?.price || order.ltp;
            
            // Logic to execute pending orders
            if (order.status === 'Pending') {
                let shouldExecute = false;
                if (order.orderType.includes("MARKET")) {
                    // Market orders execute immediately if placed during market hours (simulated)
                    shouldExecute = true; 
                } else if (order.orderType.includes("LIMIT")) {
                    if (order.type === 'BUY' && ltp <= order.limitPrice) {
                        shouldExecute = true;
                    } else if (order.type === 'SELL' && ltp >= order.limitPrice) {
                        shouldExecute = true;
                    }
                }
                
                if (shouldExecute) {
                    // In a real app, you'd call a backend to confirm execution.
                    // Here we'll just optimistically update the state.
                    const executedOrder = { ...order, status: 'Executed' as const, filledQuantity: order.quantity, ltp };
                    
                    // This part should ideally be in a centralized service.
                    // For now, we show a toast. Fund/portfolio updates happen on trade confirmation.
                    toast({
                        title: `Order Executed!`,
                        description: `${executedOrder.type} ${executedOrder.quantity} ${executedOrder.ticker} at ₹${ltp.toFixed(2)}.`
                    });

                    return executedOrder;
                }
            }

            return {
                ...order,
                ltp: ltp,
            };
        });
        
        // This check prevents unnecessary writes to localStorage
        if (JSON.stringify(updatedOrders) !== JSON.stringify(storedOrders)) {
            setOrders(updatedOrders);
            localStorage.setItem('orders', JSON.stringify(updatedOrders));
        } else {
             // Only update orders state if no executions happened, just LTP update
             setOrders(storedOrders.map(o => ({...o, ltp: stockData.find(s => s.ticker === o.ticker)?.price || o.ltp})));
        }
    };

    fetchOrdersDataAndCheckPending();
    const interval = setInterval(fetchOrdersDataAndCheckPending, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

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
                        {order.isAMO && <div className="text-gray-400">AMO REQ...</div>}
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
