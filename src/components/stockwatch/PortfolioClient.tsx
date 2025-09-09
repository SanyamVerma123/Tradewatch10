
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio, Holding, Stock } from "@/lib/types";
import { getStockData } from "@/app/actions";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { portfolio as initialPortfolioData } from "@/lib/portfolio";
import { StockActionSheet } from "./StockActionSheet";

export function PortfolioClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Holdings");
  const [searchTerm, setSearchTerm] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolioData);
  const [isLoading, setIsLoading] = useState(true);
  const [stocksMap, setStocksMap] = useState<Record<string, Stock>>({});

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  
  const updatePortfolioData = useCallback(async (isSilent = false) => {
    let currentPortfolio: Portfolio;
    try {
        const item = localStorage.getItem('portfolioData');
        currentPortfolio = item ? JSON.parse(item) : initialPortfolioData;
    } catch (e) {
        console.error("Could not parse portfolio data from local storage", e);
        currentPortfolio = initialPortfolioData;
    }

    const tickers = currentPortfolio.holdings.map(h => h.ticker);
    if (tickers.length === 0) {
      setPortfolio(currentPortfolio);
      setIsLoading(false);
      return;
    }
    
    if (!isSilent) {
        setIsLoading(true);
    }

    const stockData = await getStockData(tickers);
    
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    let totalInvestedValue = 0;
    let totalCurrentValue = 0;

    const updatedHoldings = currentPortfolio.holdings.map(holding => {
      const liveData = stockData.find(s => s.ticker === holding.ticker);
      const ltp = liveData?.price || holding.ltp;
      const dayChange = liveData?.change || 0;
      const dayChangePercent = liveData?.changePercent || 0;
      
      const investedValue = holding.avgPrice * holding.quantity;
      const currentValue = ltp * holding.quantity;
      const pnl = currentValue - investedValue;
      
      totalInvestedValue += investedValue;
      totalCurrentValue += currentValue;

      return {
        ...holding,
        ltp,
        dayChange,
        dayChangePercent,
        pnl,
        pnlPercent: (investedValue > 0) ? (pnl / investedValue) * 100 : 0,
        investedValue,
        currentValue
      };
    });

    const totalPnl = totalCurrentValue - totalInvestedValue;
    const totalPnlPercent = (totalInvestedValue > 0) ? (totalPnl / totalInvestedValue) * 100 : 0;

    const newPortfolio: Portfolio = {
      holdings: updatedHoldings,
      investedValue: totalInvestedValue,
      currentValue: totalCurrentValue,
      totalPnl,
      totalPnlPercent,
    };

    setPortfolio(newPortfolio);
    if(JSON.stringify(newPortfolio) !== JSON.stringify(currentPortfolio)) {
        localStorage.setItem('portfolioData', JSON.stringify(newPortfolio));
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    updatePortfolioData();
    const interval = setInterval(() => updatePortfolioData(true), 5000); // Silent refresh
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'portfolioData' || event.key === 'orders' || event.key === 'funds') {
        updatePortfolioData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updatePortfolioData]);

  const handleHoldingClick = (holding: Holding) => {
    const stockData = stocksMap[holding.ticker];
    if (stockData) {
      setSelectedStock(stockData);
      setIsActionSheetOpen(true);
    }
  };

  const onActionSheetTrade = (type: 'buy' | 'sell', ticker: string) => {
     if(type === 'sell'){
        const holding = portfolio.holdings.find(h => h.ticker === ticker);
        const sellOrder = {
          type: 'SELL',
          ticker: ticker,
          quantity: holding?.quantity || 1, // Default to selling all
          orderType: 'CNC' // Assume CNC for portfolio holdings
        }
        const orderQueryParam = encodeURIComponent(JSON.stringify(sellOrder));
        router.push(`/trade/${encodeURIComponent(ticker)}?order=${orderQueryParam}`);
     } else {
        router.push(`/trade/${encodeURIComponent(ticker)}`);
     }
     setIsActionSheetOpen(false);
  }

  const filteredHoldings = portfolio.holdings.filter(
    (holding) =>
      holding.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <Button variant="ghost" size="icon">
          <ChevronDown className="h-5 w-5" />
          <span className="sr-only">Options</span>
        </Button>
      </header>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="Holdings">Holdings</TabsTrigger>
          <TabsTrigger value="Positions">Positions</TabsTrigger>
        </TabsList>
        <TabsContent value="Holdings">
            <Card className="my-4">
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-sm text-muted-foreground">Invested</div>
                            <div className="text-lg font-semibold">₹{portfolio.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Current</div>
                            <div className="text-lg font-semibold">₹{portfolio.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                    <div className="mt-4 text-center">
                        <div className="text-sm text-muted-foreground">P&L</div>
                        <div className={cn("text-lg font-semibold", portfolio.totalPnl >= 0 ? "text-positive" : "text-destructive")}>
                            {portfolio.totalPnl >= 0 ? '+' : ''}{portfolio.totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ({portfolio.totalPnlPercent.toFixed(2)}%)
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="my-4 flex items-center justify-between gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="SEARCH"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="ghost" className="text-primary gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                FILTER
              </Button>
            </div>

            <div className="space-y-2">
            {isLoading ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredHoldings.length === 0 ? (
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">You have no holdings.</p>
                </div>
            ) : filteredHoldings.map((holding) => (
              <Card key={holding.id} onClick={() => handleHoldingClick(holding)} className="cursor-pointer">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    <span>{holding.quantity} Qty.</span>
                    <span className="mx-1">&bull;</span>
                    <span>Avg. {holding.avgPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                      <p className="font-bold">{holding.ticker}</p>
                      <div className={cn("text-right font-semibold", holding.pnl >= 0 ? "text-positive" : "text-destructive")}>
                          <p>{holding.pnl >= 0 ? '+' : ''}{holding.pnl.toFixed(2)}</p>
                          <p className="text-xs">({holding.pnlPercent.toFixed(2)}%)</p>
                      </div>
                  </div>
                  <div className="flex justify-between items-end mt-1 text-xs text-muted-foreground">
                    <div>
                        <span>Invested {holding.investedValue.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                        <span>LTP {holding.ltp.toFixed(2)} <span className={cn(holding.dayChange >= 0 ? "text-positive" : "text-destructive")}>({holding.dayChangePercent.toFixed(2)}%)</span></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
        </TabsContent>
        <TabsContent value="Positions">
          <div className="text-center py-10">
            <p className="text-muted-foreground">You have no positions for the day.</p>
          </div>
        </TabsContent>
      </Tabs>
      <StockActionSheet 
        stock={selectedStock} 
        isOpen={isActionSheetOpen} 
        onOpenChange={setIsActionSheetOpen} 
        onTrade={onActionSheetTrade}
      />
    </div>
  );
}
