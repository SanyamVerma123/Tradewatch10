
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Order, Stock, Portfolio, Holding } from "@/lib/types";
import { getStockData } from "@/app/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MoreVertical, Info, RefreshCcw, Loader2, ChevronsRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface TradeClientProps {
  ticker: string;
  initialStock: Stock;
  orderToEdit?: Order;
}

type OrderType = "BUY" | "SELL";
type StopLossTargetMode = 'PERCENT' | 'PRICE';

const SwipeButton = ({ onSwipe, orderType, disabled, buttonText }: { onSwipe: () => void, orderType: OrderType, disabled?: boolean, buttonText: string }) => {
    const [swiping, setSwiping] = useState(false);
    const [position, setPosition] = useState(0);
    const swipeRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLButtonElement>(null);
    const hasSwiped = useRef(false);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
        if(disabled || hasSwiped.current) return;
        setSwiping(true);
    };

    const handleInteractionMove = (clientX: number) => {
        if (!swiping || !containerRef.current || !swipeRef.current || hasSwiped.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const maxPosition = containerRect.width - swipeRef.current.offsetWidth - 8; // 4px padding on each side
        let newPosition = clientX - containerRect.left - (swipeRef.current.offsetWidth / 2);

        if (newPosition < 4) newPosition = 4;
        if (newPosition > maxPosition) newPosition = maxPosition;
        
        setPosition(newPosition);

        if (newPosition >= maxPosition - 5) { // Threshold for completion
            hasSwiped.current = true;
            onSwipe();
            setTimeout(() => { hasSwiped.current = false; }, 1000); // Prevent multi-swipe
            resetSwipe();
        }
    };

    const handleInteractionEnd = () => {
        if (!swiping) return;
        // Snap back if not completed
        const containerRect = containerRef.current?.getBoundingClientRect();
        const maxPosition = (containerRect?.width || 0) - (swipeRef.current?.offsetWidth || 0) - 8;
        if (position < maxPosition - 5) {
             const interval = setInterval(() => {
                setPosition(p => {
                    const newPos = p - 20;
                    if(newPos <= 4) {
                        clearInterval(interval);
                        return 4;
                    }
                    return newPos;
                });
            }, 10)
        }
        setSwiping(false);
    };
    
    const resetSwipe = () => {
        const snapBack = setInterval(() => {
            setPosition(p => {
                const newPos = p - 20;
                if(newPos <= 4) {
                    clearInterval(snapBack);
                    return 4;
                }
                return newPos;
            });
        }, 10);
        setSwiping(false);
    }
    
     useEffect(() => {
        hasSwiped.current = false;
        resetSwipe();
    }, [orderType, disabled, buttonText]);


    return (
        <Button
            ref={containerRef}
            className={cn(
                "w-full h-12 text-lg relative overflow-hidden p-1 cursor-ew-resize rounded-md",
                orderType === "BUY" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-600"
            )}
            onMouseDown={handleInteractionStart}
            onTouchStart={(e) => e.type === 'touchstart' && handleInteractionStart(e)}
            onMouseMove={(e) => swiping && handleInteractionMove(e.clientX)}
            onTouchMove={(e) => swiping && e.type === 'touchmove' && handleInteractionMove(e.touches[0].clientX)}
            onMouseUp={handleInteractionEnd}
            onTouchEnd={handleInteractionEnd}
            onMouseLeave={handleInteractionEnd}
            disabled={disabled}
        >
            <div
                ref={swipeRef}
                className="absolute top-1/2 -translate-y-1/2 h-10 w-12 bg-white/30 rounded-md flex items-center justify-center pointer-events-none"
                style={{ left: `${position}px`, transition: swiping ? 'none' : 'left 0.3s ease-out' }}
            >
                <ChevronsRight className="h-6 w-6 text-white" />
            </div>
            <span className="text-white pointer-events-none">{buttonText}</span>
        </Button>
    );
};

function isMarketOpen() {
    const now = new Date();
    const istOffset = 330; 
    const utcOffset = now.getTimezoneOffset();
    const istTime = new Date(now.getTime() + (istOffset + utcOffset) * 60000);
    
    const day = istTime.getDay();
    if (day === 0 || day === 6) return false;

    const hour = istTime.getHours();
    const minute = istTime.getMinutes();

    if (hour > 9 || (hour === 9 && minute >= 15)) {
        if (hour < 15 || (hour === 15 && minute <= 30)) {
            return true;
        }
    }
    return false;
}

async function showOrderNotification(ticker: string) {
    if (!('serviceWorker' in navigator) || !window.Notification || Notification.permission !== 'granted') {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("Order Submitted", {
        body: `Your order for ${ticker} has been submitted.`,
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
      });
    } catch (err) {
      console.error('Error showing order notification:', err);
    }
}


export function TradeClient({ ticker, initialStock, orderToEdit }: TradeClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stock, setStock] = useState<Stock | null>(initialStock);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const isSellFromHolding = orderToEdit?.isSellFromHolding;
  const [user, setUser] = useState<User | null>(null);

  const [orderType, setOrderType] = useState<OrderType>(orderToEdit?.type || "BUY");
  const [quantity, setQuantity] = useState(orderToEdit?.quantity?.toString() || "1");
  const [price, setPrice] = useState(orderToEdit?.price?.toString() || "");
  const [triggerPrice, setTriggerPrice] = useState(orderToEdit?.triggerPrice?.toString() || "");
  
  const initialProduct = orderToEdit?.product || (isSellFromHolding ? "CNC" : "MIS");
  const initialOrderMethod = orderToEdit?.orderMethod || "MARKET";

  const [product, setProduct] = useState(initialProduct.toUpperCase());
  const [orderMethod, setOrderMethod] = useState(initialOrderMethod.toUpperCase());
  
  const [isStoplossEnabled, setIsStoplossEnabled] = useState(false);
  const [isTargetEnabled, setIsTargetEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialStock);
  
  const [stoplossMode, setStoplossMode] = useState<StopLossTargetMode>('PERCENT');
  const [targetMode, setTargetMode] = useState<StopLossTargetMode>('PERCENT');
  const [stoplossPercent, setStoplossPercent] = useState("");
  const [stoplossPrice, setStoplossPrice] = useState("");
  const [targetPercent, setTargetPercent] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);


  const fetchStock = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await getStockData([ticker]);
      if (data && data.length > 0) {
        const newStock = data[0];
        setStock(newStock);
        if (price === "" || orderMethod === "MARKET") { 
            setPrice(newStock.price.toFixed(2));
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch stock data." });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch stock data." });
    } finally {
        if (!isSilent) setIsLoading(false);
    }
  }, [ticker, toast, price, orderMethod]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);
        
      const fundsData = JSON.parse(localStorage.getItem(`funds_${sbUser.id}`) || '{}');
      setAvailableFunds(fundsData.balance || 0);

      const portfolioData = JSON.parse(localStorage.getItem(`portfolioData_${sbUser.id}`) || '{}');
      setHoldings(portfolioData.holdings || []);
    }
    
    fetchUserAndData();

    if(orderToEdit) {
        setOrderType(orderToEdit.type || "BUY");
        setProduct(orderToEdit.product?.toUpperCase() || (isSellFromHolding ? "CNC" : "MIS"));
        setOrderMethod(orderToEdit.orderMethod?.toUpperCase() || "MARKET");
        setQuantity(orderToEdit.quantity?.toString() || "1");
        setPrice(orderToEdit.price?.toString() || "");
    }
  }, [orderToEdit, isSellFromHolding, router]);

  useEffect(() => {
    fetchStock();
    const interval = setInterval(() => fetchStock(true), 5000);
    return () => clearInterval(interval);
  }, [fetchStock]);
  
  useEffect(() => {
    if (stock && (price === "" || (orderMethod === "MARKET" && price !== stock.price.toFixed(2)))) {
        setPrice(stock.price.toFixed(2));
    }
  }, [stock, orderMethod, price]);

  const isEditing = !!orderToEdit?.id && !orderToEdit?.isSellFromHolding;

  const getExecutionPrice = () => {
    if (orderMethod.includes('MARKET')) {
        return stock?.price || 0;
    }
    return parseFloat(price) || stock?.price || 0;
  }

  const tradeValue = (parseInt(quantity) || 0) * getExecutionPrice();
  const approxMargin = product === 'MIS' ? tradeValue / 5 : tradeValue;

  const currentHolding = holdings.find(h => h.ticker === ticker);
  const maxSellQuantity = isSellFromHolding ? (currentHolding?.quantity || 0) : 10000;

  const executeOrder = (order: Order) => {
    if(!stock || !user) return;
    const ordersKey = `orders_${user.id}`;
    const fundsKey = `funds_${user.id}`;

    const executionPrice = getExecutionPrice();
    const executedOrder: Order = { 
        ...order, 
        status: 'Executed', 
        filledQuantity: order.quantity, 
        ltp: executionPrice,
        executedAt: new Date().toISOString()
    };
    
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const existingOrderIndex = allOrders.findIndex(o => o.id === executedOrder.id);

    if (existingOrderIndex > -1) {
        allOrders[existingOrderIndex] = executedOrder;
    } else {
        allOrders = [executedOrder, ...allOrders];
    }
    localStorage.setItem(ordersKey, JSON.stringify(allOrders));
    
    const finalTradeValue = executedOrder.quantity * executedOrder.ltp;
    const brokerage = Math.min(20, finalTradeValue * 0.0005);
    const stt = order.type === 'BUY' ? 0 : product === 'MIS' ? finalTradeValue * 0.00025 : finalTradeValue * 0.001;
    const totalCharges = brokerage + stt + (finalTradeValue * 0.000345);
    
    const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
    const newBalance = order.type === 'BUY' ? fundsData.balance - finalTradeValue - totalCharges : fundsData.balance + finalTradeValue - totalCharges;
    localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: Math.max(0, newBalance) }));
    setAvailableFunds(Math.max(0, newBalance));
    
    toast({
        title: `Order Executed!`,
        description: `${order.type} ${executedOrder.quantity} ${ticker}. Est. charges: ₹${totalCharges.toFixed(2)}`
    });

    setTimeout(() => showOrderNotification(ticker), 60000); // 1 minute delay

    router.push('/orders');
  }


  const handlePlaceOrder = () => {
    if(isLoading || !stock || !user) return;
    const ordersKey = `orders_${user.id}`;
    
    const requiredFunds = approxMargin + 50; // Add buffer for charges

    if (orderType === 'BUY' && requiredFunds > availableFunds) {
      toast({ variant: "destructive", title: "Insufficient Funds", description: `Required: ~₹${requiredFunds.toFixed(2)}. Available: ₹${availableFunds.toFixed(2)}.` });
      return;
    }
    
    if (orderType === 'SELL' && isSellFromHolding && (parseInt(quantity) || 0) > maxSellQuantity) {
       toast({ variant: "destructive", title: "Insufficient Holdings", description: `You can sell a maximum of ${maxSellQuantity} shares.` });
       return;
    }

    const marketIsOpen = isMarketOpen();
    const limitPrice = orderMethod.includes('MARKET') ? stock.price : parseFloat(price) || 0;

    const newOrder: Order = {
        id: (isEditing && orderToEdit?.id) ? orderToEdit.id : `order-${Date.now()}`,
        type: orderType,
        ticker,
        quantity: parseInt(quantity) || 0,
        filledQuantity: 0,
        limitPrice: limitPrice,
        triggerPrice: parseFloat(triggerPrice) || undefined,
        status: 'Pending',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exchange: stock.exchange || 'NSE',
        orderType: `${product} ${orderMethod}`,
        ltp: stock?.price || 0,
        isAMO: !marketIsOpen,
        product: product,
        orderMethod: orderMethod,
        price: orderMethod.includes("MARKET") ? stock.price.toString() : price,
        isSellFromHolding: isSellFromHolding,
        executedAt: '',
    }

    if (newOrder.quantity <= 0) {
        toast({ variant: "destructive", title: "Invalid Quantity", description: "Quantity must be greater than zero." });
        return;
    }
    if ((orderMethod === 'LIMIT' || orderMethod === 'SL') && newOrder.limitPrice <= 0) {
        toast({ variant: "destructive", title: "Invalid Price", description: "Price must be greater than zero for Limit/SL orders." });
        return;
    }
     if ((orderMethod === 'SL' || orderMethod === 'SL-M') && (!newOrder.triggerPrice || newOrder.triggerPrice <= 0)) {
        toast({ variant: "destructive", title: "Invalid Trigger Price", description: "Trigger price is required for SL orders." });
        return;
    }

    // For market orders during open market, simulate immediate execution
    if (orderMethod.includes('MARKET') && marketIsOpen) {
        toast({title: "Executing Market Order..."});
        setTimeout(() => executeOrder(newOrder), 1500); // simulate network delay
        return;
    }

    const storedOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    let updatedOrders;
    if(isEditing) {
        updatedOrders = storedOrders.map((o: Order) => o.id === newOrder.id ? newOrder : o);
    } else {
        updatedOrders = [newOrder, ...storedOrders];
    }
    localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));

    toast({
        title: `Order ${isEditing ? 'Modified' : 'Placed'} (${orderType})`,
        description: `${quantity} shares of ${ticker} at ${orderMethod.includes('MARKET') ? 'Market Price' : `₹${price}`}. ${!marketIsOpen ? '(AMO)' : ''}`,
    });

    setTimeout(() => showOrderNotification(ticker), 60000); // 1 minute delay
    
    router.push('/orders');
  }

  const handleCancelOrder = () => {
    if (!user || !orderToEdit) return;
    const ordersKey = `orders_${user.id}`;
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const updatedOrders = allOrders.map(o => o.id === orderToEdit.id ? { ...o, status: 'Cancelled' } : o);
    localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
    toast({
        variant: "destructive",
        title: "Order Cancelled",
        description: `Your pending order for ${orderToEdit.ticker} has been cancelled.`,
    });
    router.push('/orders');
  };

  const isSLOrder = orderMethod === "SL" || orderMethod === "SL-M";
  const swipeText = `SWIPE TO ${isEditing ? 'MODIFY' : orderType}`;
  
  const entryPrice = getExecutionPrice();

  const PageLoader = () => (
    <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="flex flex-col h-screen">
        <header className="flex items-center justify-between px-4 pt-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold">{ticker}</h1>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{stock?.name}</p>
            </div>
          </div>
            {isEditing && (
                <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Cancel Order</span>
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will cancel your pending order for {quantity} shares of {ticker}. This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Dismiss</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleCancelOrder}
                        >
                            Yes, Cancel Order
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </header>

        {isLoading ? <PageLoader /> : (
             <div className="px-4 my-4 flex items-baseline gap-x-2">
                <p className="text-2xl font-bold">₹{stock?.price.toFixed(2)}</p>
                <p className={cn("font-semibold text-base", stock?.change && stock.change >= 0 ? "text-positive" : "text-destructive")}>
                  {stock?.change && stock.change >= 0 ? '+' : ''}{stock?.change.toFixed(2)} ({stock?.changePercent.toFixed(2)}%)
                </p>
            </div>
        )}
        
        <main className="flex-1 overflow-y-auto pb-4">
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as OrderType)} className="w-full">
              {isSellFromHolding ? (
                 <div className="px-4">
                    <h2 className="text-center font-bold text-lg text-red-600">SELL FROM HOLDING</h2>
                 </div>
              ) : (
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="BUY" disabled={isEditing && orderToEdit?.type === 'SELL'} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Buy</TabsTrigger>
                    <TabsTrigger value="SELL" disabled={isEditing && orderToEdit?.type === 'BUY'} className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
                </TabsList>
              )}
              <div className="p-4 space-y-6">
                  <Tabs defaultValue="Regular" className="w-full">
                      <TabsList>
                          <TabsTrigger value="Regular">Regular</TabsTrigger>
                          <TabsTrigger value="Cover">Cover</TabsTrigger>
                          <TabsTrigger value="AMO">AMO</TabsTrigger>
                          <TabsTrigger value="Iceberg">Iceberg</TabsTrigger>
                      </TabsList>
                  </Tabs>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <Label htmlFor="quantity">Quantity</Label>
                          <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} max={orderType === 'SELL' && product === 'CNC' ? maxSellQuantity : undefined} />
                          {orderType === 'SELL' && product === 'CNC' && <p className="text-xs text-muted-foreground">Holding: {maxSellQuantity}</p>}
                          {orderType === 'BUY' && <p className="text-xs text-muted-foreground">Lot size 1</p>}
                      </div>
                      <div className="space-y-1">
                          <Label htmlFor="price">Price</Label>
                          <Input id="price" type="number" value={price} onChange={e => setPrice(e.target.value)} disabled={orderMethod === "MARKET" || orderMethod === "SL-M"} />
                          <p className="text-xs text-muted-foreground">Tick size 0.05</p>
                      </div>
                  </div>
                  {isSLOrder && (
                      <div className="space-y-1 animate-in fade-in-50">
                          <Label htmlFor="trigger-price">Trigger Price</Label>
                          <Input id="trigger-price" type="number" value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)} placeholder="Enter trigger price" />
                      </div>
                  )}


                  <div className="space-y-2">
                      <Label>Product</Label>
                      <RadioGroup value={product} onValueChange={setProduct} className="flex gap-4">
                          <Button asChild variant="outline" className={cn("flex-1", product === "MIS" && "border-primary text-primary")}>
                              <Label className="flex-col items-center justify-center h-full gap-0 p-2 cursor-pointer">
                                  <RadioGroupItem value="MIS" id="mis" className="sr-only" disabled={isSellFromHolding} />
                                  Intraday <span className="text-xs text-muted-foreground">MIS</span>
                              </Label>
                          </Button>
                          <Button asChild variant="outline" className={cn("flex-1", product === "CNC" && "border-primary text-primary")}>
                              <Label className="flex-col items-center justify-center h-full gap-0 p-2 cursor-pointer">
                                  <RadioGroupItem value="CNC" id="cnc" className="sr-only" disabled={orderType === 'SELL' && !currentHolding && !isSellFromHolding} />
                                  Longterm <span className="text-xs text-muted-foreground">CNC</span>
                              </Label>
                          </Button>
                      </RadioGroup>
                  </div>

                  <div className="space-y-2">
                      <Label>Type</Label>
                      <RadioGroup value={orderMethod} onValueChange={setOrderMethod} className="flex gap-2 flex-wrap">
                          <Button asChild variant="outline" className={cn("flex-1", orderMethod === "MARKET" && "border-primary text-primary")}>
                              <Label className="px-4 py-2 cursor-pointer">
                                  <RadioGroupItem value="MARKET" id="market" className="sr-only"/>
                                  Market
                              </Label>
                          </Button>
                            <Button asChild variant="outline" className={cn("flex-1",orderMethod === "LIMIT" && "border-primary text-primary")}>
                              <Label className="px-4 py-2 cursor-pointer">
                                  <RadioGroupItem value="LIMIT" id="limit" className="sr-only"/>
                                  Limit
                              </Label>
                          </Button>
                          <Button asChild variant="outline" className={cn("flex-1", orderMethod === "SL" && "border-primary text-primary")}>
                              <Label className="px-4 py-2 cursor-pointer">
                                  <RadioGroupItem value="SL" id="sl" className="sr-only"/>
                                  SL
                              </Label>
                          </Button>
                          <Button asChild variant="outline" className={cn("flex-1", orderMethod === "SL-M" && "border-primary text-primary")}>
                              <Label className="px-4 py-2 cursor-pointer">
                                  <RadioGroupItem value="SL-M" id="sl-m" className="sr-only"/>
                                  SL-M
                              </Label>
                          </Button>
                      </RadioGroup>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                          <Label htmlFor="set-stoploss" className="flex items-center gap-2 cursor-pointer">
                              <span>Set stoploss</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                          </Label>
                          <Switch id="set-stoploss" checked={isStoplossEnabled} onCheckedChange={setIsStoplossEnabled} />
                      </div>
                      {isStoplossEnabled && (
                          <div className="space-y-2 animate-in fade-in-50">
                              <RadioGroup value={stoplossMode} onValueChange={(v) => setStoplossMode(v as StopLossTargetMode)} className="flex gap-2">
                                <Label htmlFor="sl-percent" className={cn("text-xs", stoplossMode === 'PERCENT' && 'text-primary')}>%</Label>
                                <RadioGroupItem value="PERCENT" id="sl-percent" className="sr-only"/>
                                <Switch checked={stoplossMode === 'PRICE'} onCheckedChange={(c) => setStoplossMode(c ? 'PRICE' : 'PERCENT')} />
                                <Label htmlFor="sl-price" className={cn("text-xs", stoplossMode === 'PRICE' && 'text-primary')}>Price</Label>
                                <RadioGroupItem value="PRICE" id="sl-price" className="sr-only"/>
                              </RadioGroup>
                              <div className="relative">
                                <Input 
                                    type="number" 
                                    value={stoplossMode === 'PERCENT' ? stoplossPercent : stoplossPrice}
                                    onChange={(e) => stoplossMode === 'PERCENT' ? setStoplossPercent(e.target.value) : setStoplossPrice(e.target.value)}
                                    placeholder={stoplossMode === 'PERCENT' ? `-2.0 (i.e. ₹${(entryPrice * 0.98).toFixed(2)})` : `${(entryPrice * 0.98).toFixed(2)}`}
                                />
                                {stoplossMode === 'PERCENT' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>}
                              </div>
                          </div>
                      )}
                      <div className="flex items-center justify-between">
                          <Label htmlFor="set-target" className="flex items-center gap-2 cursor-pointer">
                              <span>Set target</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                          </Label>
                          <Switch id="set-target" checked={isTargetEnabled} onCheckedChange={setIsTargetEnabled} />
                      </div>
                      {isTargetEnabled && (
                           <div className="space-y-2 animate-in fade-in-50">
                              <RadioGroup value={targetMode} onValueChange={(v) => setTargetMode(v as StopLossTargetMode)} className="flex gap-2">
                                <Label htmlFor="target-percent" className={cn("text-xs", targetMode === 'PERCENT' && 'text-primary')}>%</Label>
                                <RadioGroupItem value="PERCENT" id="target-percent" className="sr-only"/>
                                <Switch checked={targetMode === 'PRICE'} onCheckedChange={(c) => setTargetMode(c ? 'PRICE' : 'PERCENT')} />
                                <Label htmlFor="target-price" className={cn("text-xs", targetMode === 'PRICE' && 'text-primary')}>Price</Label>
                                <RadioGroupItem value="PRICE" id="target-price" className="sr-only"/>
                              </RadioGroup>
                              <div className="relative">
                                 <Input 
                                    type="number" 
                                    value={targetMode === 'PERCENT' ? targetPercent : targetPrice}
                                    onChange={(e) => targetMode === 'PERCENT' ? setTargetPercent(e.target.value) : setTargetPrice(e.target.value)}
                                    placeholder={targetMode === 'PERCENT' ? `4.0 (i.e. ₹${(entryPrice * 1.04).toFixed(2)})` : `${(entryPrice * 1.04).toFixed(2)}`}
                                />
                                {targetMode === 'PERCENT' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </Tabs>
        </main>

        {!isLoading && (
        <footer className="bg-background border-t p-4 w-full mt-auto sticky bottom-0">
          <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center text-xs mb-2">
                  <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Approx. margin</span>
                      <span className="font-semibold">₹{approxMargin.toFixed(2)}</span>
                       {product === 'MIS' && <Badge variant="outline">5x leverage</Badge>}
                      <RefreshCcw className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Avail.</span>
                      <span className="font-semibold">₹{availableFunds.toFixed(2)}</span>
                  </div>
              </div>
               <SwipeButton onSwipe={handlePlaceOrder} orderType={orderType} disabled={isLoading} buttonText={swipeText} />
          </div>
        </footer>
        )}
    </div>
  );
}

    
