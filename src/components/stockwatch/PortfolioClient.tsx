

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio, Holding, Stock, Order, Position } from "@/lib/types";
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

const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

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
    if (!isSilent) setIsLoading(true);
    
    let currentHoldings: Holding[];
    let allOrders: Order[];

    try {
        const item = localStorage.getItem('portfolioData');
        currentHoldings = item ? JSON.parse(item).holdings : initialPortfolioData.holdings;
        const ordersItem = localStorage.getItem('orders');
        allOrders = ordersItem ? JSON.parse(ordersItem) : [];
    } catch (e) {
        console.error("Could not parse data from local storage", e);
        currentHoldings = initialPortfolioData.holdings;
        allOrders = [];
    }
    
    const holdingTickers = currentHoldings.map(h => h.ticker);
    const executedOrders = allOrders.filter(o => o.status === 'Executed');
    const todayExecutedOrders = executedOrders.filter(o => o.executedAt && isToday(new Date(o.executedAt)));
    const positionTickers = todayExecutedOrders.map(o => o.ticker);
    
    const allTickers = [...new Set([...holdingTickers, ...positionTickers])];

    if (allTickers.length === 0) {
      setPortfolio({
          ...initialPortfolioData,
          holdings: [],
          positions: [],
          investedValue: 0,
          currentValue: 0,
          totalPnl: 0,
          dayPnl: 0,
      });
      setIsLoading(false);
      return;
    }
    
    const stockData = await getStockData(allTickers);
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    // 1. Calculate Holdings P&L (from previous days)
    let totalHoldingsInvested = 0;
    let totalHoldingsCurrentValue = 0;
    let holdingsDayPnl = 0;

    const updatedHoldings = currentHoldings.map(holding => {
      const liveData = newStocksMap[holding.ticker];
      const ltp = liveData?.price || holding.ltp;
      const prevClose = liveData?.previousClose || holding.avgPrice;
      
      const investedValue = holding.avgPrice * holding.quantity;
      const currentValue = ltp * holding.quantity;
      const pnl = currentValue - investedValue;
      const dayPnlForHolding = (ltp - prevClose) * holding.quantity;
      holdingsDayPnl += dayPnlForHolding;
      
      totalHoldingsInvested += investedValue;
      totalHoldingsCurrentValue += currentValue;

      return {
        ...holding,
        ltp,
        dayChange: liveData?.change || 0,
        dayChangePercent: liveData?.changePercent || 0,
        pnl,
        pnlPercent: (investedValue > 0) ? (pnl / investedValue) * 100 : 0,
        investedValue,
        currentValue
      };
    });

    // 2. Calculate Today's Positions & P&L
    let positionsDayPnl = 0;
    let misMarginUsed = 0;

    const positionMap: { [ticker: string]: Position } = {};
    
    const cncTradesToday = todayExecutedOrders.filter(o => o.product === 'CNC');

    for(const holding of currentHoldings) {
        const sellsToday = cncTradesToday.filter(o => o.ticker === holding.ticker && o.type === 'SELL');
        const buysToday = cncTradesToday.filter(o => o.ticker === holding.ticker && o.type === 'BUY');
        const soldQty = sellsToday.reduce((sum, o) => sum + o.quantity, 0);
        const boughtQty = buysToday.reduce((sum, o) => sum + o.quantity, 0);

        if (soldQty > 0) {
            holdingsDayPnl -= sellsToday.reduce((sum, o) => sum + ((newStocksMap[o.ticker]?.previousClose || o.ltp) - o.ltp) * o.quantity, 0)
        }
    }


    const misTradesToday = todayExecutedOrders.filter(o => o.product === 'MIS');

    for (const order of [...misTradesToday, ...cncTradesToday]) {
        if(order.isSellFromHolding) continue;

        const ltp = newStocksMap[order.ticker]?.price || order.ltp;
        let p = positionMap[order.ticker];

        if (!p) {
            p = {
                id: `pos-${order.ticker}`,
                ticker: order.ticker,
                product: order.product || 'MIS',
                quantity: 0,
                avgPrice: 0,
                ltp: ltp,
                pnl: 0,
                investedValue: 0,
                dayChange: newStocksMap[order.ticker]?.change || 0,
                dayChangePercent: newStocksMap[order.ticker]?.changePercent || 0,
                pnlPercent: 0,
                type: 'BUY', // This will be determined by net quantity
            };
            positionMap[order.ticker] = p;
        }
        
        p.ltp = ltp;

        if (order.type === 'BUY') {
            const newTotalValue = (p.avgPrice * p.quantity) + (order.ltp * order.quantity);
            p.quantity += order.quantity;
            p.avgPrice = p.quantity !== 0 ? newTotalValue / p.quantity : 0;
        } else { // SELL
            const newTotalValue = (p.avgPrice * p.quantity) - (order.ltp * order.quantity);
            p.quantity -= order.quantity;
            p.avgPrice = p.quantity !== 0 ? newTotalValue / p.quantity : 0;
        }
    }
    
    const updatedPositions = Object.values(positionMap).filter(p => p.quantity !== 0);

    updatedPositions.forEach(p => {
        p.type = p.quantity > 0 ? 'BUY' : 'SELL';
        const netQty = Math.abs(p.quantity);
        
        const pnl = (p.ltp - p.avgPrice) * p.quantity;
        p.pnl = pnl;
        positionsDayPnl += pnl;

        if(p.product === 'MIS') {
            const tradesForPos = misTradesToday.filter(o => o.ticker === p.ticker);
            const totalTradeValue = tradesForPos.reduce((sum, o) => sum + (o.ltp * o.quantity), 0);
            misMarginUsed += totalTradeValue / 5; // Approx 5x leverage
        }
        
        const liveData = newStocksMap[p.ticker];
        p.dayChange = liveData?.change || 0;
        p.dayChangePercent = liveData?.changePercent || 0;
        p.investedValue = p.avgPrice * netQty;
        p.pnlPercent = p.investedValue > 0 ? (pnl / p.investedValue) * 100 : 0;
    });

    
    // 3. Combine for final portfolio view
    const dayPnl = holdingsDayPnl + positionsDayPnl;
    const totalInvested = totalHoldingsInvested;
    const totalCurrentValue = totalHoldingsCurrentValue + positionsDayPnl;
    const totalPnl = totalCurrentValue - totalInvested;
    
    const newPortfolio: Portfolio = {
      investedValue: totalInvested,
      currentValue: totalCurrentValue,
      totalPnl: totalPnl,
      totalPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
      dayPnl: dayPnl,
      dayPnlPercent: (totalInvested + misMarginUsed) > 0 ? (dayPnl / (totalInvested + misMarginUsed)) * 100 : 0,
      holdings: updatedHoldings.filter(h => h.quantity > 0),
      positions: updatedPositions,
    };

    setPortfolio(newPortfolio);
    
    const newPortfolioDataToStore = { holdings: newPortfolio.holdings };
    localStorage.setItem('portfolioData', JSON.stringify(newPortfolioDataToStore));
    
    setIsLoading(false);
  }, []);


  useEffect(() => {
    updatePortfolioData();
    const interval = setInterval(() => updatePortfolioData(true), 5000);
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'portfolioData' || event.key === 'orders') {
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

  const handlePositionClick = (position: Position) => {
     const stockData = stocksMap[position.ticker];
    if (stockData) {
      setSelectedStock(stockData);
      setIsActionSheetOpen(true);
    }
  }

  const onActionSheetTrade = (type: 'buy' | 'sell', ticker: string, isFromHolding: boolean) => {
     const holding = portfolio.holdings.find(h => h.ticker === ticker);
     const stock = stocksMap[ticker];

     const orderData: Partial<Order> = {
        type: type.toUpperCase() as 'BUY' | 'SELL',
        ticker: ticker,
        quantity: (type === 'sell' && isFromHolding) ? (holding?.quantity || 1) : 1,
        product: isFromHolding ? 'CNC' : 'MIS',
        orderMethod: 'MARKET',
        ltp: stock?.price || 0,
        price: stock?.price?.toFixed(2) || '0',
        isSellFromHolding: isFromHolding && type === 'sell'
     };
     
     router.push(`/trade/${encodeURIComponent(ticker)}?order=${encodeURIComponent(JSON.stringify(orderData))}`);
     setIsActionSheetOpen(false);
  }

  const filteredHoldings = portfolio.holdings.filter(
    (holding) =>
      holding.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredPositions = portfolio.positions.filter(
    (pos) =>
      pos.ticker.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div>
                    <div className="text-sm text-muted-foreground">Overall P&L</div>
                    <div className={cn("text-lg font-semibold", portfolio.totalPnl >= 0 ? "text-positive" : "text-destructive")}>
                        {portfolio.totalPnl >= 0 ? '+' : ''}{portfolio.totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div>
                    <div className="text-sm text-muted-foreground">Day's P&L</div>
                    <div className={cn("text-lg font-semibold", portfolio.dayPnl >= 0 ? "text-positive" : "text-destructive")}>
                        {portfolio.dayPnl >= 0 ? '+' : ''}{portfolio.dayPnl.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="Holdings">Holdings ({filteredHoldings.length})</TabsTrigger>
          <TabsTrigger value="Positions">Positions ({filteredPositions.length})</TabsTrigger>
        </TabsList>
        
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
        
        <TabsContent value="Holdings">
            <div className="space-y-2">
            {isLoading ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredHoldings.length === 0 ? (
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">You have no holdings.</p>
                    <Button variant="link" onClick={() => router.push('/watchlist')}>Start Investing</Button>
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
          <div className="space-y-2">
             {isLoading ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredPositions.length === 0 ? (
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">You have no positions for the day.</p>
                     <Button variant="link" onClick={() => router.push('/watchlist')}>Start Trading</Button>
                </div>
            ) : filteredPositions.map((pos) => (
              <Card key={pos.id} onClick={() => handlePositionClick(pos)} className="cursor-pointer">
                 <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <div>
                        <span>{pos.product}</span>
                        <span className="mx-1">&bull;</span>
                        <span>{Math.abs(pos.quantity)} Qty.</span>
                        <span className="mx-1">&bull;</span>
                        <span>Avg. {pos.avgPrice.toFixed(2)}</span>
                    </div>
                    <span className={cn("font-semibold", pos.type === 'BUY' ? 'text-blue-500' : 'text-red-500')}>{pos.type}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                      <p className="font-bold">{pos.ticker}</p>
                      <div className={cn("text-right font-semibold", pos.pnl >= 0 ? "text-positive" : "text-destructive")}>
                          <p>{pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}</p>
                      </div>
                  </div>
                  <div className="flex justify-between items-end mt-1 text-xs text-muted-foreground">
                    <div>
                        <span></span>
                    </div>
                    <div className="text-right">
                        <span>LTP {pos.ltp.toFixed(2)} <span className={cn(pos.dayChange >= 0 ? "text-positive" : "text-destructive")}>({pos.dayChangePercent.toFixed(2)}%)</span></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <StockActionSheet 
        stock={selectedStock} 
        isOpen={isActionSheetOpen} 
        onOpenChange={setIsActionSheetOpen} 
        onTrade={onActionSheetTrade}
        tradeButtonVariant="buy-sell"
        isFromHolding={activeTab === 'Holdings'}
      />
    </div>
  );
}
    

    