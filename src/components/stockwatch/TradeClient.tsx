"use client";

import { useState, useEffect, useCallback } from "react";
import type { Stock } from "@/lib/types";
import { getStockData, getHistoricalData } from "@/app/actions";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical, Info, RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockChart } from "@/components/stockwatch/StockChart";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { HistoricalHistoryResult } from "yahoo-finance2/dist/esm/src/modules/historical";


interface TradeClientProps {
  ticker: string;
  initialStock: Stock;
}

type OrderType = "BUY" | "SELL";

const Fundamentals = ({ stock }: { stock: Stock }) => {
  const data = [
    { label: "Open", value: stock.open?.toFixed(2) },
    { label: "High", value: stock.dayHigh?.toFixed(2) },
    { label: "Low", value: stock.dayLow?.toFixed(2) },
    { label: "Prev. Close", value: stock.previousClose?.toFixed(2) },
    { label: "Volume", value: stock.volume?.toLocaleString('en-IN') },
    { label: "Avg. Volume", value: stock.avgVolume?.toLocaleString('en-IN') },
  ];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Market Depth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {data.map(item => (
            <div key={item.label} className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">₹{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};


export function TradeClient({ ticker, initialStock }: TradeClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stock, setStock] = useState<Stock | null>(initialStock);
  const [historicalData, setHistoricalData] = useState<HistoricalHistoryResult | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("BUY");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [product, setProduct] = useState("CNC");
  const [orderMethod, setOrderMethod] = useState("Limit");
  const [stoploss, setStoploss] = useState("");
  const [target, setTarget] = useState("");
  const [isStoplossEnabled, setIsStoplossEnabled] = useState(false);
  const [isTargetEnabled, setIsTargetEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialStock);

  const fetchStock = useCallback(async () => {
    try {
      const data = await getStockData([ticker]);
      if (data && data.length > 0) {
        setStock(data[0]);
        if (!price) { // Set price only on first load
            setPrice(data[0].price.toFixed(2));
        }
      } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not fetch stock data."
        })
      }
    } catch (error) {
      console.error(error);
      toast({
            variant: "destructive",
            title: "Error",
            description: "Could not fetch stock data."
        })
    } finally {
        setIsLoading(false);
    }
  }, [ticker, toast, price]);

  const fetchHistorical = useCallback(async () => {
    const data = await getHistoricalData(ticker);
    setHistoricalData(data);
  }, [ticker]);


  useEffect(() => {
    fetchStock();
    fetchHistorical();
    const interval = setInterval(fetchStock, 5000); // Refresh every 5s on this page
    return () => clearInterval(interval);
  }, [fetchStock, fetchHistorical]);

  const approxMargin = (parseInt(quantity) || 0) * (parseFloat(price) || 0);

  const handleSwipe = () => {
    toast({
        title: `Order Placed (${orderType})`,
        description: `${quantity} shares of ${ticker} at ₹${price}.`,
    });
    router.push('/orders');
  }

  const PageLoader = () => (
    <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="pb-28">
      <header className="mb-4 flex items-center justify-between px-4 pt-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <h1 className="text-xl font-bold">{ticker}</h1>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical />
        </Button>
      </header>

      {isLoading ? <PageLoader /> : (
          <>
            <div className="px-4">
                <p className="text-2xl font-bold mb-1">₹{stock?.price.toFixed(2)}</p>
                <p className={cn("font-semibold", stock?.change && stock.change >= 0 ? "text-positive" : "text-destructive")}>
                   {stock?.change && stock.change >= 0 ? '+' : ''}{stock?.change.toFixed(2)} ({stock?.changePercent.toFixed(2)}%)
                </p>
            </div>
            
            <div className="h-64 my-4">
                <StockChart data={historicalData} isPositive={stock?.change ? stock.change >= 0 : true}/>
            </div>
            
            <div className="px-4">
              <Fundamentals stock={stock!} />
            </div>

             <Tabs value={orderType} onValueChange={(value) => setOrderType(value as OrderType)} className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="BUY" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Buy</TabsTrigger>
                    <TabsTrigger value="SELL" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
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
                            <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                            <p className="text-xs text-muted-foreground">Lot size 1</p>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="price">Price</Label>
                            <Input id="price" type="number" value={price} onChange={e => setPrice(e.target.value)} />
                             <p className="text-xs text-muted-foreground">Tick size 0.05</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Product</Label>
                        <RadioGroup value={product} onValueChange={setProduct} className="flex gap-4">
                             <Button asChild variant="outline" className={cn("flex-1", product === "MIS" && "border-primary text-primary")}>
                                <Label className="flex-col items-center justify-center h-full gap-0 p-2">
                                    <RadioGroupItem value="MIS" id="mis" className="sr-only"/>
                                    Intraday <span className="text-xs text-muted-foreground">MIS</span>
                                </Label>
                            </Button>
                            <Button asChild variant="outline" className={cn("flex-1", product === "CNC" && "border-primary text-primary")}>
                                <Label className="flex-col items-center justify-center h-full gap-0 p-2">
                                     <RadioGroupItem value="CNC" id="cnc" className="sr-only"/>
                                     Longterm <span className="text-xs text-muted-foreground">CNC</span>
                                </Label>
                            </Button>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label>Type</Label>
                         <RadioGroup value={orderMethod} onValueChange={setOrderMethod} className="flex gap-2">
                             <Button asChild variant="outline" className={cn("flex-1", orderMethod === "Market" && "border-primary text-primary")}>
                                <Label className="px-4 py-2">
                                    <RadioGroupItem value="Market" id="market" className="sr-only"/>
                                    Market
                                </Label>
                             </Button>
                              <Button asChild variant="outline" className={cn("flex-1",orderMethod === "Limit" && "border-primary text-primary")}>
                                <Label className="px-4 py-2">
                                     <RadioGroupItem value="Limit" id="limit" className="sr-only"/>
                                     Limit
                                </Label>
                            </Button>
                            <Button asChild variant="outline" className={cn("flex-1", orderMethod === "SL" && "border-primary text-primary")}>
                                <Label className="px-4 py-2">
                                     <RadioGroupItem value="SL" id="sl" className="sr-only"/>
                                     SL
                                </Label>
                            </Button>
                             <Button asChild variant="outline" className={cn("flex-1", orderMethod === "SL-M" && "border-primary text-primary")}>
                                <Label className="px-4 py-2">
                                     <RadioGroupItem value="SL-M" id="sl-m" className="sr-only"/>
                                     SL-M
                                </Label>
                            </Button>
                        </RadioGroup>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="set-stoploss" className="flex items-center gap-2">
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
                            <Label htmlFor="set-target" className="flex items-center gap-2">
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
          </>
      )}

      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center text-xs mb-2">
            <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Approx. margin</span>
                <span className="font-semibold">₹{approxMargin.toFixed(2)}</span>
                <RefreshCcw className="h-3 w-3 text-primary" />
            </div>
            <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Avail.</span>
                <span className="font-semibold">₹500.00</span>
            </div>
        </div>
        <Button 
            className={cn("w-full h-12 text-lg", orderType === "BUY" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700")}
            onClick={handleSwipe}
            disabled={isLoading}
        >
          SWIPE TO {orderType}
        </Button>
      </footer>
    </div>
  );
}
