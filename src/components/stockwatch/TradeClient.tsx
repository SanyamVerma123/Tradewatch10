
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Order, Stock, Portfolio, Holding } from "@/lib/types";
import { getStockData } from "@/app/actions";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical, Info, RefreshCcw, Loader2, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface TradeClientProps {
  ticker: string;
  initialStock: Stock;
  orderToEdit?: Order;
}

type OrderType = "BUY" | "SELL";

const SwipeButton = ({ onSwipe, orderType, disabled }: { onSwipe: () => void, orderType: OrderType, disabled?: boolean }) => {
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
        setPosition(4);
        setSwiping(false);
    }
    
     useEffect(() => {
        // Reset hasSwiped when the order details change, allowing for another swipe
        hasSwiped.current = false;
    }, [orderType, disabled]);


    return (
        <Button
            ref={containerRef}
            className={cn(
                "w-full h-12 text-lg relative overflow-hidden p-1 cursor-ew-resize rounded-md",
                orderType === "BUY" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
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
            <span className="text-white pointer-events-none">SWIPE TO {orderType}</span>
        </Button>
    );
};


export function TradeClient({ ticker, initialStock, orderToEdit }: TradeClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stock, setStock] = useState<Stock | null>(initialStock);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  // Order State
  const [orderType, setOrderType] = useState<OrderType>(orderToEdit?.type || "BUY");
  const [quantity, setQuantity] = useState(orderToEdit?.quantity.toString() || "1");
  const [price, setPrice] = useState(orderToEdit?.limitPrice?.toString() || "");
  const [triggerPrice, setTriggerPrice] = useState(orderToEdit?.triggerPrice?.toString() || "");
  const [product, setProduct] = useState((orderToEdit?.orderType.split(' ')[0] || "CNC").toUpperCase());
  const [orderMethod, setOrderMethod] = useState((orderToEdit?.orderType.split(' ')[1] || "Limit").toUpperCase());
  
  // Advanced options
  const [stoploss, setStoploss] = useState("");
  const [target, setTarget] = useState("");
  const [isStoplossEnabled, setIsStoplossEnabled] = useState(false);
  const [isTargetEnabled, setIsTargetEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialStock);

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
    const fundsData = JSON.parse(localStorage.getItem('funds') || '{}');
    setAvailableFunds(fundsData.balance || 0);

    const portfolioData = JSON.parse(localStorage.getItem('portfolioData') || '{}');
    setHoldings(portfolioData.holdings || []);
  }, []);

  useEffect(() => {
    fetchStock();
    const interval = setInterval(() => fetchStock(true), 5000);
    return () => clearInterval(interval);
  }, [fetchStock]);

  const isEditing = !!orderToEdit;

  const currentPrice = orderMethod === 'MARKET' || orderMethod === 'SL-M' ? stock?.price || 0 : parseFloat(price) || 0
  const tradeValue = (parseInt(quantity) || 0) * currentPrice;
  const approxMargin = product === 'MIS' ? tradeValue / 5 : tradeValue;

  const currentHolding = holdings.find(h => h.ticker === ticker);
  const maxSellQuantity = currentHolding?.quantity || 0;

  const handlePlaceOrder = () => {
    if(isLoading) return;

    if (orderType === 'BUY' && approxMargin > availableFunds) {
      toast({ variant: "destructive", title: "Insufficient Funds", description: `You need ₹${approxMargin.toFixed(2)} but have ₹${availableFunds.toFixed(2)}.` });
      return;
    }
    
    if (orderType === 'SELL' && (parseInt(quantity) || 0) > maxSellQuantity) {
       toast({ variant: "destructive", title: "Insufficient Holdings", description: `You can sell a maximum of ${maxSellQuantity} shares.` });
       return;
    }

    const newOrder: Order = {
        id: orderToEdit?.id || `order-${Date.now()}`,
        type: orderType,
        ticker,
        quantity: parseInt(quantity) || 0,
        filledQuantity: 0,
        limitPrice: currentPrice,
        triggerPrice: parseFloat(triggerPrice) || undefined,
        status: 'Pending',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exchange: 'NSE',
        orderType: `${product} ${orderMethod}`,
        ltp: stock?.price || 0,
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

    const storedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    let updatedOrders;
    if(isEditing) {
        updatedOrders = storedOrders.map((o: Order) => o.id === newOrder.id ? newOrder : o);
    } else {
        updatedOrders = [newOrder, ...storedOrders];
    }
    localStorage.setItem('orders', JSON.stringify(updatedOrders));

    toast({
        title: `Order ${isEditing ? 'Modified' : 'Placed'} (${orderType})`,
        description: `${quantity} shares of ${ticker} at ${orderMethod === 'MARKET' ? 'Market Price' : `₹${price}`}.`,
    });
    
    // Simulate order execution after a delay and show charges
    setTimeout(() => {
        const executedOrder = { ...newOrder, status: 'Executed' as const, filledQuantity: newOrder.quantity, ltp: stock?.price || newOrder.limitPrice };
        const finalOrders = JSON.parse(localStorage.getItem('orders') || '[]').map((o: Order) => o.id === executedOrder.id ? executedOrder : o);
        localStorage.setItem('orders', JSON.stringify(finalOrders));
        
        // Simulate Tax & Fund deduction/addition
        const finalTradeValue = executedOrder.quantity * executedOrder.ltp;
        const brokerage = Math.min(20, finalTradeValue * 0.0005);
        const stt = orderType === 'BUY' ? 0 : product === 'MIS' ? finalTradeValue * 0.00025 : finalTradeValue * 0.001;
        const totalCharges = brokerage + stt + (finalTradeValue * 0.000345); // Other minor charges
        
        const fundsData = JSON.parse(localStorage.getItem('funds') || '{}');
        const newBalance = orderType === 'BUY' ? fundsData.balance - finalTradeValue - totalCharges : fundsData.balance + finalTradeValue - totalCharges;
        localStorage.setItem('funds', JSON.stringify({ ...fundsData, balance: newBalance }));
        setAvailableFunds(newBalance);

        // Update portfolio
        const portfolioData: Portfolio = JSON.parse(localStorage.getItem('portfolioData') || '{}');
        let newHoldings = [...(portfolioData.holdings || [])];
        const holdingIndex = newHoldings.findIndex(h => h.ticker === ticker);

        if (orderType === 'BUY') {
            if (holdingIndex > -1) {
                const existingHolding = newHoldings[holdingIndex];
                const totalQuantity = existingHolding.quantity + executedOrder.quantity;
                const newAvgPrice = ((existingHolding.avgPrice * existingHolding.quantity) + (executedOrder.ltp * executedOrder.quantity)) / totalQuantity;
                newHoldings[holdingIndex] = { ...existingHolding, quantity: totalQuantity, avgPrice: newAvgPrice };
            } else {
                newHoldings.push({
                    id: `holding-${Date.now()}`,
                    ticker: ticker,
                    quantity: executedOrder.quantity,
                    avgPrice: executedOrder.ltp,
                    ltp: executedOrder.ltp,
                    pnl: 0,
                    pnlPercent: 0,
                    dayChange: stock?.change || 0,
                    dayChangePercent: stock?.changePercent || 0,
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
            description: `${orderType} ${executedOrder.quantity} ${ticker}. Est. charges: ₹${totalCharges.toFixed(2)}`
        });

        if (!isEditing) {
             router.push('/orders');
        }

    }, 3000);
    if(isEditing){
        router.push('/orders');
    }
  }

  const isSLOrder = orderMethod === "SL" || orderMethod === "SL-M";

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
          <Button variant="ghost" size="icon">
            <MoreVertical />
          </Button>
        </header>

        {isLoading ? <PageLoader /> : (
            <div className="px-4 my-4">
                  <p className="text-2xl font-bold">₹{stock?.price.toFixed(2)}</p>
                  <p className={cn("font-semibold", stock?.change && stock.change >= 0 ? "text-positive" : "text-destructive")}>
                    {stock?.change && stock.change >= 0 ? '+' : ''}{stock?.change.toFixed(2)} ({stock?.changePercent.toFixed(2)}%)
                  </p>
            </div>
        )}
        
        <main className="flex-1 overflow-y-auto pb-4">
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as OrderType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="BUY" disabled={isEditing && orderToEdit?.type === 'SELL'} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Buy</TabsTrigger>
                  <TabsTrigger value="SELL" disabled={isEditing && orderToEdit?.type === 'BUY'} className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
              </TabsList>
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
                          <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} max={orderType === 'SELL' ? maxSellQuantity : undefined} />
                          {orderType === 'SELL' && <p className="text-xs text-muted-foreground">Holding: {maxSellQuantity}</p>}
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
                                  <RadioGroupItem value="MIS" id="mis" className="sr-only"/>
                                  Intraday <span className="text-xs text-muted-foreground">MIS</span>
                              </Label>
                          </Button>
                          <Button asChild variant="outline" className={cn("flex-1", product === "CNC" && "border-primary text-primary")}>
                              <Label className="flex-col items-center justify-center h-full gap-0 p-2 cursor-pointer">
                                  <RadioGroupItem value="CNC" id="cnc" className="sr-only"/>
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
                          <div className="grid grid-cols-2 gap-4 items-center animate-in fade-in-50">
                              <Label htmlFor="stoploss-percent">Stoploss %</Label>
                              <div className="relative">
                                  <Input id="stoploss-percent" type="number" value={stoploss} onChange={e => setStoploss(e.target.value)} placeholder="-5.0" />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
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
                          <div className="grid grid-cols-2 gap-4 items-center animate-in fade-in-50">
                              <Label htmlFor="target-percent">Target %</Label>
                              <div className="relative">
                                  <Input id="target-percent" type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="5.0" />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
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
               <SwipeButton onSwipe={handlePlaceOrder} orderType={orderType} disabled={isLoading} />
          </div>
        </footer>
        )}
    </div>
  );
}

    