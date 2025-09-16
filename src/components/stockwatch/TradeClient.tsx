

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Order, Stock, Portfolio, Holding, Position } from "@/lib/types";
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
            if (!hasSwiped.current) {
                onSwipe();
                hasSwiped.current = true;
            }
            setTimeout(() => { resetSwipe(); hasSwiped.current = false; }, 500);
        }
    };

    const handleInteractionEnd = () => {
        if (!swiping || hasSwiped.current) return;
        // Snap back if not completed
        const containerRect = containerRef.current?.getBoundingClientRect();
        const maxPosition = (containerRect?.width || 0) - (swipeRef.current?.offsetWidth || 0) - 8;
        if (position < maxPosition - 5) {
             resetSwipe();
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
  const [user, setUser] = useState<User | null>(null);

  const [orderType, setOrderType] = useState<OrderType>(orderToEdit?.type || "BUY");
  const [quantity, setQuantity] = useState(orderToEdit?.quantity?.toString() || "1");
  const [price, setPrice] = useState(orderToEdit?.limitPrice?.toString() || "");
  const [triggerPrice, setTriggerPrice] = useState(orderToEdit?.triggerPrice?.toString() || "");
  
  const isSellFromHolding = useMemo(() => orderToEdit?.isSellFromHolding, [orderToEdit]);
  const initialProduct = useMemo(() => orderToEdit?.product || (orderToEdit?.isShortSell ? 'MIS' : (orderToEdit?.isLong ? 'CNC' : 'MIS')), [orderToEdit]);
  const initialOrderMethod = useMemo(() => orderToEdit?.orderMethod || "LIMIT", [orderToEdit]);

  const [product, setProduct] = useState(initialProduct.toUpperCase());
  const [orderMethod, setOrderMethod] = useState(initialOrderMethod.toUpperCase());
  
  const [isStockLoading, setIsStockLoading] = useState(false);
  
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);

  const [portfolio, setPortfolio] = useState<Portfolio>({ holdings: [], positions: [], investedValue: 0, currentValue: 0, totalPnl: 0, totalPnlPercent: 0, dayPnl: 0, dayPnlPercent: 0 });

  const fetchStock = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsStockLoading(true);
    try {
      const data = await getStockData([ticker]);
      if (data && data.length > 0) {
        const newStock = data[0];
        setStock(newStock);
        if (orderMethod === "MARKET" || !price) { 
            setPrice(newStock.price.toFixed(2));
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch stock data." });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch stock data." });
    } finally {
        if (!isSilent) setIsStockLoading(false);
    }
  }, [ticker, toast, orderMethod, price]);

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

      const portfolioDataText = localStorage.getItem(`portfolioData_${sbUser.id}`);
      if(portfolioDataText){
          try {
            const portfolioData: Portfolio = JSON.parse(portfolioDataText);
            setPortfolio(portfolioData);
          } catch(e) {
            console.error("Failed to parse portfolio data", e)
          }
      }
    }
    
    fetchUserAndData();

    if(orderToEdit) {
        setOrderType(orderToEdit.type || "BUY");
        setProduct(orderToEdit.product?.toUpperCase() || (orderToEdit.isShortSell ? 'MIS' : (orderToEdit.isLong ? 'CNC' : 'MIS')));
        setOrderMethod(orderToEdit.orderMethod?.toUpperCase() || "LIMIT");
        setQuantity(orderToEdit.quantity?.toString() || "1");
        setPrice(orderToEdit.limitPrice?.toString() || initialStock?.price?.toFixed(2) || "");
        setTriggerPrice(orderToEdit.triggerPrice?.toString() || "");
    }
  }, [orderToEdit, router, initialStock?.price]);

  useEffect(() => {
    if (!initialStock) {
        fetchStock();
    }
    const interval = setInterval(() => fetchStock(true), 2000);
    return () => clearInterval(interval);
  }, [fetchStock, initialStock]);
  
  const isEditing = !!orderToEdit?.id && !orderToEdit?.isSellFromHolding;
  
  const getExecutionPrice = useCallback(() => {
    if (orderMethod.includes('MARKET')) {
        return stock?.price || 0;
    }
    return parseFloat(price) || stock?.price || 0;
  }, [orderMethod, price, stock?.price]);

  const tradeValue = useMemo(() => (parseInt(quantity) || 0) * getExecutionPrice(), [quantity, getExecutionPrice]);
  const approxMargin = useMemo(() => product === 'MIS' ? tradeValue / 5 : tradeValue, [product, tradeValue]);
  const brokerage = useMemo(() => Math.min(20, tradeValue * 0.0003), [tradeValue]);
  const totalCharges = useMemo(() => brokerage + (tradeValue * 0.000345), [brokerage, tradeValue]); // Simplified charges
  const requiredFunds = useMemo(() => approxMargin + totalCharges, [approxMargin, totalCharges]);

  const currentPosition = useMemo(() => (portfolio.positions || []).find(p => p.ticker === ticker && p.product === product), [portfolio.positions, ticker, product]);
  const currentHolding = useMemo(() => (portfolio.holdings || []).find(h => h.ticker === ticker), [portfolio.holdings, ticker]);
  
  const isExitingPosition = useMemo(() => {
      if (orderToEdit) return !!orderToEdit.product;
      if (orderType === 'BUY' && currentPosition && currentPosition.quantity < 0) return true; // Buying to close a short
      if (orderType === 'SELL' && currentPosition && currentPosition.quantity > 0) return true; // Selling to close a long
      return false;
  }, [orderToEdit, orderType, currentPosition]);

  const isShortSell = useMemo(() => orderType === 'SELL' && !isSellFromHolding && !currentPosition && !currentHolding, [orderType, isSellFromHolding, currentPosition, currentHolding]);

  const maxSellQuantity = useMemo(() => {
    // If we are editing an order to sell, the available quantity is just that order's quantity.
    if (orderToEdit?.quantity) {
      return orderToEdit.quantity;
    }
    // Otherwise, calculate the total available from holdings and positions.
    const holdingQty = portfolio.holdings?.find(h => h.ticker === ticker)?.quantity || 0;
    const positionQty = portfolio.positions?.find(p => p.ticker === ticker && p.quantity > 0)?.quantity || 0;
    return holdingQty + positionQty;
  }, [portfolio.holdings, portfolio.positions, ticker, orderToEdit]);


  const handlePlaceOrder = () => {
    if(!stock || !user) return;
    const ordersKey = `orders_${user.id}`;
    
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
        toast({ variant: "destructive", title: "Invalid Quantity", description: "Quantity must be greater than zero." });
        return;
    }

    if (orderType === 'BUY' && requiredFunds > availableFunds) {
      toast({ variant: "destructive", title: "Insufficient Funds", description: `Required: ~₹${requiredFunds.toFixed(2)}. Available: ₹${availableFunds.toFixed(2)}.` });
      return;
    }
    
    if (orderType === 'SELL' && qty > maxSellQuantity && !isShortSell) {
       toast({ variant: "destructive", title: "Insufficient Holdings", description: `You only have ${maxSellQuantity} shares to sell.` });
       return;
    }

    const marketIsOpen = isMarketOpen();
    const executionPrice = getExecutionPrice();
    
    if ((orderMethod === 'LIMIT' || orderMethod === 'SL') && executionPrice <= 0) {
        toast({ variant: "destructive", title: "Invalid Price", description: "Price must be greater than zero for Limit/SL orders." });
        return;
    }
     if ((orderMethod === 'SL' || orderMethod === 'SL-M') && (!triggerPrice || parseFloat(triggerPrice) <= 0)) {
        toast({ variant: "destructive", title: "Invalid Trigger Price", description: "Trigger price is required for SL orders." });
        return;
    }
    
    // Block funds for BUY orders immediately
    if (orderType === 'BUY') {
        const fundsKey = `funds_${user.id}`;
        const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
        const newBalance = (fundsData.balance || 0) - requiredFunds;
        localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: newBalance }));
        setAvailableFunds(newBalance);
    }

    const newOrder: Order = {
        id: (isEditing && orderToEdit?.id) ? orderToEdit.id : `order-${Date.now()}`,
        type: orderType,
        ticker,
        quantity: qty,
        filledQuantity: 0,
        limitPrice: executionPrice,
        triggerPrice: parseFloat(triggerPrice) || undefined,
        status: 'Pending',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exchange: stock.exchange || 'NSE',
        orderType: `${product} ${orderMethod}`,
        ltp: stock?.price || 0,
        isAMO: !marketIsOpen,
        product: product,
        orderMethod: orderMethod,
        isSellFromHolding: isSellFromHolding,
    };

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

    router.push('/orders');
  }

  const handleCancelOrder = () => {
    if (!user || !orderToEdit) return;
    const ordersKey = `orders_${user.id}`;
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');

    // Refund if it was a BUY order
    if (orderToEdit.type === 'BUY') {
        const fundsKey = `funds_${user.id}`;
        const fundsData = JSON.parse(localStorage.getItem(fundsKey) || '{}');
        if (fundsData.balance !== undefined) {
             const orderValue = orderToEdit.quantity * (orderToEdit.orderMethod === "MARKET" ? orderToEdit.ltp : orderToEdit.limitPrice);
             const orderMargin = orderToEdit.product === 'MIS' ? orderValue / 5 : orderValue;
             const orderBrokerage = Math.min(20, orderValue * 0.0003);
             const orderCharges = orderBrokerage + (orderValue * 0.000345);
             const fundsToRefund = orderMargin + orderCharges;

            const newBalance = fundsData.balance + fundsToRefund;
            localStorage.setItem(fundsKey, JSON.stringify({ ...fundsData, balance: newBalance }));
            setAvailableFunds(newBalance);
        }
    }

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
  
  let swipeText = `SWIPE TO ${orderType}`;
  if(isEditing) {
    swipeText = `SWIPE TO MODIFY`;
  } else if (isExitingPosition) {
    swipeText = `SWIPE TO EXIT`;
  }
  
  const PageLoader = () => (
    <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
  
  const isProductDisabled = useMemo(() => {
    if (isSellFromHolding) return true; // Always CNC if selling from holding
    if (isExitingPosition) return true; // Product is determined by existing position
    if (orderType === 'SELL' && !isExitingPosition && !currentHolding) return true; // Short sell must be MIS
    return false;
  }, [isSellFromHolding, isExitingPosition, orderType, currentHolding]);

  // Effect to manage product type constraints
  useEffect(() => {
    if (isSellFromHolding) {
      setProduct('CNC');
    } else if (isShortSell) {
      setProduct('MIS');
    }
  }, [isSellFromHolding, isShortSell]);

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

        {(!stock || (isStockLoading && !stock)) ? <PageLoader /> : (
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
                    <TabsTrigger value="BUY" disabled={isExitingPosition && orderType === 'SELL'} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Buy</TabsTrigger>
                    <TabsTrigger value="SELL" disabled={isExitingPosition && orderType === 'BUY'} className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
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
                          <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                          {orderType === 'SELL' && <p className="text-xs text-muted-foreground">Available: {maxSellQuantity}</p>}
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
                              <Label className={cn("flex-col items-center justify-center h-full gap-0 p-2", isProductDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                                  <RadioGroupItem value="MIS" id="mis" className="sr-only" disabled={isProductDisabled} />
                                  Intraday <span className="text-xs text-muted-foreground">MIS</span>
                              </Label>
                          </Button>
                          <Button asChild variant="outline" className={cn("flex-1", product === "CNC" && "border-primary text-primary")}>
                              <Label className={cn("flex-col items-center justify-center h-full gap-0 p-2", isProductDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                                  <RadioGroupItem value="CNC" id="cnc" className="sr-only" disabled={isProductDisabled} />
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

              </div>
          </Tabs>
        </main>

        {stock && (
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
               <SwipeButton onSwipe={handlePlaceOrder} orderType={orderType} disabled={isStockLoading} buttonText={swipeText} />
          </div>
        </footer>
        )}
    </div>
  );
}
