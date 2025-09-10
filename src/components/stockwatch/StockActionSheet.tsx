
"use client";

import type { Stock } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useMemo } from "react";
import { StockChart } from "@/components/stockwatch/StockChart";
import { getHistoricalData } from "@/app/actions";
import type { HistoricalHistoryResult } from "yahoo-finance2/dist/esm/src/modules/historical";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface StockActionSheetProps {
  stock: Stock | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTrade?: (type: 'buy' | 'sell', ticker: string, isFromHolding: boolean) => void;
  tradeButtonVariant?: 'long-short' | 'buy-sell';
  isFromHolding?: boolean;
}

type Timeframe = '5d' | '1mo' | '3mo' | '1y' | 'max';

const timeframes: { label: string; value: Timeframe }[] = [
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: 'Max', value: 'max' },
];

const Fundamentals = ({ stock }: { stock: Stock }) => {
  const data = [
    { label: "Open", value: stock.open?.toFixed(2) },
    { label: "High", value: stock.dayHigh?.toFixed(2) },
    { label: "Low", value: stock.dayLow?.toFixed(2) },
    { label: "Prev. Close", value: stock.previousClose?.toFixed(2) },
    { label: "Bid", value: stock.bid?.toFixed(2) },
    { label: "Ask", value: stock.ask?.toFixed(2) },
    { label: "52W High", value: stock.fiftyTwoWeekHigh?.toFixed(2) },
    { label: "52W Low", value: stock.fiftyTwoWeekLow?.toFixed(2) },
    { label: "Volume", value: stock.volume?.toLocaleString('en-IN') },
    { label: "Market Cap", value: typeof stock.marketCap === 'number' ? `₹${(stock.marketCap / 10000000).toFixed(2)}Cr` : stock.marketCap },
  ];

  return (
     <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Fundamentals</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {data.map(item => (
            <div key={item.label} className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value || '-'}</span>
            </div>
          ))}
        </div>
        <a href={`https://www.screener.in/company/${stock.ticker.replace('.NS', '')}/`} target="_blank" rel="noopener noreferrer">
          <Button variant="link" className="p-0 h-auto mt-2 text-primary">
              See more <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </a>
    </div>
  );
};

const MarketDepth = ({ stock }: { stock: Stock }) => {
  const [marketData, setMarketData] = useState<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });

  useEffect(() => {
    const generateMarketData = () => {
      const newBids = [];
      const newAsks = [];
      const basePrice = stock.price;
      const spread = stock.price * 0.001;

      for (let i = 0; i < 5; i++) {
        newBids.push({
          price: (basePrice - spread * (i + 1) - Math.random() * 0.05).toFixed(2),
          orders: Math.floor(Math.random() * 10) + 1,
          quantity: Math.floor(Math.random() * 500) + 50,
        });
        newAsks.push({
          price: (basePrice + spread * (i + 1) + Math.random() * 0.05).toFixed(2),
          orders: Math.floor(Math.random() * 10) + 1,
          quantity: Math.floor(Math.random() * 500) + 50,
        });
      }
      setMarketData({ bids: newBids, asks: newAsks });
    };

    generateMarketData();
    const interval = setInterval(generateMarketData, 2000); // Simulate real-time updates

    return () => clearInterval(interval);
  }, [stock.price]);

  const totalBidQuantity = useMemo(() => marketData.bids.reduce((sum, d) => sum + d.quantity, 0), [marketData.bids]);
  const totalAskQuantity = useMemo(() => marketData.asks.reduce((sum, d) => sum + d.quantity, 0), [marketData.asks]);


  return (
    <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Market Depth</h3>
        <div className="overflow-hidden rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center text-blue-500">Bids</TableHead>
                        <TableHead className="text-center">Price</TableHead>
                        <TableHead className="text-center text-red-500">Asks</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell className="text-center">
                                <div className="text-blue-400">{marketData.bids[i]?.quantity}</div>
                                <div className="text-xs text-muted-foreground">{marketData.bids[i]?.orders} orders</div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                                <div className="text-blue-500">{marketData.bids[i]?.price}</div>
                                <div className="text-red-500 mt-1">{marketData.asks[i]?.price}</div>
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="text-red-400">{marketData.asks[i]?.quantity}</div>
                                <div className="text-xs text-muted-foreground">{marketData.asks[i]?.orders} orders</div>
                            </TableCell>
                        </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                        <TableCell className="text-center font-bold">{totalBidQuantity.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-semibold">Total</TableCell>
                        <TableCell className="text-center font-bold">{totalAskQuantity.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    </div>
  );
};


export function StockActionSheet({ stock, isOpen, onOpenChange, onTrade, tradeButtonVariant = 'long-short', isFromHolding = false }: StockActionSheetProps) {
    const [historicalData, setHistoricalData] = useState<HistoricalHistoryResult | null>(null);
    const [timeframe, setTimeframe] = useState<Timeframe>('3mo');

    const fetchHistorical = useCallback(async () => {
        if (stock) {
            setHistoricalData(null); // Reset on new stock/timeframe
            const data = await getHistoricalData(stock.ticker, timeframe);
            setHistoricalData(data);
        }
    }, [stock, timeframe]);

    useEffect(() => {
        if(isOpen && stock) {
            fetchHistorical();
        }
    }, [isOpen, stock, fetchHistorical]);

    if (!stock) return null;

    const handleTradeClick = (type: 'buy' | 'sell') => {
        if (onTrade) {
          onTrade(type, stock.ticker, isFromHolding);
        }
    };
    
    const buyText = isFromHolding ? 'Buy More' : (tradeButtonVariant === 'long-short' ? 'Long' : 'Buy');
    const sellText = isFromHolding ? 'Sell' : (tradeButtonVariant === 'long-short' ? 'Short' : 'Sell');


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-lg max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg">{stock.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-4">
            <span className="truncate max-w-[120px] sm:max-w-xs">{stock.ticker}</span>
            <span className={cn("font-semibold", stock.change >= 0 ? "text-positive" : "text-destructive")}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
            </span>
          </SheetDescription>
        </SheetHeader>
        
        <div className="h-64 my-4">
          <StockChart data={historicalData} isPositive={stock.change >= 0} />
        </div>
        
        <div className="flex justify-center mb-4">
            <RadioGroup 
                value={timeframe} 
                onValueChange={(value) => setTimeframe(value as Timeframe)} 
                className="flex gap-2 bg-muted p-1 rounded-md"
            >
                {timeframes.map(tf => (
                    <div key={tf.value} className="flex items-center">
                        <RadioGroupItem value={tf.value} id={`tf-${tf.value}`} className="sr-only" />
                        <Label 
                            htmlFor={`tf-${tf.value}`}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors",
                                timeframe === tf.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                            )}
                        >
                            {tf.label}
                        </Label>
                    </div>
                ))}
            </RadioGroup>
        </div>

        <div className="flex justify-center mb-4">
             <a href={`https://in.tradingview.com/chart/?symbol=NSE:${stock.ticker.replace('.NS', '')}`} target="_blank" rel="noopener noreferrer" className="text-primary text-sm font-medium flex items-center gap-2">
                View full chart <ExternalLink className="h-4 w-4" />
            </a>
        </div>
        
        <Separator />

        <div className="py-4">
          <MarketDepth stock={stock} />
        </div>

        <Separator />

        <div className="py-4">
          <Fundamentals stock={stock} />
        </div>
        
        <Separator />
        
        <div className="py-4 sticky bottom-0 bg-background">
            <div className="grid grid-cols-2 gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleTradeClick('buy')}>{buyText}</Button>
                <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleTradeClick('sell')}>{sellText}</Button>
            </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}
