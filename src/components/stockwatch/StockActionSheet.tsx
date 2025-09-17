
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
import { useState, useEffect, useCallback, memo } from "react";
import { StockChart } from "@/components/stockwatch/StockChart";
import { getHistoricalData } from "@/app/actions";
import type { HistoricalHistoryResult } from "yahoo-finance2/dist/esm/src/modules/historical";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";


interface StockActionSheetProps {
  stock: Stock | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTrade?: (action: 'add' | 'exit' | 'buy' | 'sell', ticker: string) => void;
  tradeButtonVariant?: 'long-short' | 'buy-sell' | 'add-exit';
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
    { label: "Day's High", value: stock.dayHigh?.toFixed(2) },
    { label: "Day's Low", value: stock.dayLow?.toFixed(2) },
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

const MemoizedStockChart = memo(StockChart);


export function StockActionSheet({ stock, isOpen, onOpenChange, onTrade, tradeButtonVariant = 'long-short' }: StockActionSheetProps) {
    const [historicalData, setHistoricalData] = useState<HistoricalHistoryResult | null>(null);
    const [timeframe, setTimeframe] = useState<Timeframe>('3mo');

    const fetchHistorical = useCallback(async () => {
        if (stock) {
            setHistoricalData(null); // Reset on new stock/timeframe
            const data = await getHistoricalData(stock.ticker, timeframe);
            setHistoricalData(data);
        }
    }, [stock?.ticker, timeframe]);

    useEffect(() => {
        if(isOpen && stock) {
            fetchHistorical();
        }
    }, [isOpen, stock?.ticker, fetchHistorical]);

    if (!stock) return null;

    const handleTradeClick = (action: 'add' | 'exit' | 'buy' | 'sell') => {
        if (onTrade) {
          onTrade(action, stock.ticker);
        }
    };
    
    const getButtonLabels = () => {
        switch(tradeButtonVariant) {
            case 'add-exit':
                return { primary: 'Add', secondary: 'Exit' };
            case 'buy-sell':
                return { primary: 'Buy', secondary: 'Sell' };
            case 'long-short':
                return { primary: 'Long', secondary: 'Short' };
            default:
                return { primary: 'Buy', secondary: 'Sell' };
        }
    }

    const { primary, secondary } = getButtonLabels();
    const primaryAction = tradeButtonVariant === 'add-exit' ? 'add' : 'buy';
    const secondaryAction = tradeButtonVariant === 'add-exit' ? 'exit' : 'sell';

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
          <MemoizedStockChart data={historicalData} isPositive={stock.change >= 0} />
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
          <Fundamentals stock={stock} />
        </div>
        
        <Separator />
        
        <div className="py-4 sticky bottom-0 bg-background">
            <div className="grid grid-cols-2 gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleTradeClick(primaryAction)}>{primary}</Button>
                <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleTradeClick(secondaryAction)}>{secondary}</Button>
            </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}
