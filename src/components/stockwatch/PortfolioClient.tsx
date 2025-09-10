

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";

const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function getISTDate() {
    const now = new Date();
    const istOffset = 330; // 5.5 hours in minutes
    const utcOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (istOffset + utcOffset) * 60000);
}

const isMarketClosedForAutoSquareOff = () => {
    const istTime = getISTDate();
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const day = istTime.getDay();
    if(day === 0 || day === 6) return false; // Not on weekends
    // After 3:30 PM
    return hours > 15 || (hours === 15 && minutes >= 30);
}


export function PortfolioClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Holdings");
  const [searchTerm, setSearchTerm] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolioData);
  const [isLoading, setIsLoading] = useState(true);
  const [stocksMap, setStocksMap] = useState<Record<string, Stock>>({});

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  
  const updatePortfolioData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    
    let allOrders: Order[];
    try {
        const ordersItem = localStorage.getItem('orders');
        allOrders = ordersItem ? JSON.parse(ordersItem) : [];
    } catch (e) {
        console.error("Could not parse orders from local storage", e);
        allOrders = [];
    }
    
    const executedOrders = allOrders.filter(o => o.status === 'Executed' && o.executedAt);

    // Filter out orders that are not from today for position calculation
    const todayExecutedOrders = executedOrders.filter(o => isToday(new Date(o.executedAt!)));
    
    // Tickers to fetch data for
    let allTickersInPortfolio: string[] = [];
    try {
      const storedPortfolio = JSON.parse(localStorage.getItem('portfolioData') || '{}');
      const holdingTickers = (storedPortfolio.holdings || []).map((h: Holding) => h.ticker);
      allTickersInPortfolio = [...new Set([...holdingTickers])];
    } catch(e) {
        // ignore
    }

    const allTickersInOrders = [...new Set(allOrders.map(o => o.ticker))];
    const allTickers = [...new Set([...allTickersInPortfolio, ...allTickersInOrders])];


    if (allTickers.length === 0) {
      setPortfolio({ ...initialPortfolioData, holdings: [], positions: [] });
      setIsLoading(false);
      localStorage.setItem('portfolioData', JSON.stringify({ holdings: [], positions: [] }));
      return;
    }
    
    const stockData = await getStockData(allTickers);
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    // 1. Calculate Historical holdings from ALL CNC trades up to now
    const holdingsMap: { [ticker: string]: Holding } = {};
    const cncOrders = executedOrders.filter(o => o.product === 'CNC' || o.isSellFromHolding);

    for (const order of cncOrders) {
        const orderDate = new Date(order.executedAt!);
        let holding = holdingsMap[order.ticker];
        
        if (order.type === 'BUY') {
            if (!holding) {
                holding = {
                    id: `holding-${order.ticker}`,
                    ticker: order.ticker,
                    quantity: 0, avgPrice: 0, investedValue: 0, ltp: 0, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0,
                };
                holdingsMap[order.ticker] = holding;
            }
            const tradeValue = order.ltp * order.quantity;
            const newTotalValue = (holding.avgPrice * holding.quantity) + tradeValue;
            holding.quantity += order.quantity;
            holding.avgPrice = holding.quantity > 0 ? newTotalValue / holding.quantity : 0;
        } else { // SELL from holding
            if (holding) {
              holding.quantity -= order.quantity;
            }
        }
    }

    // Only include holdings not created today
    const pastHoldings = Object.values(holdingsMap).filter(h => h.quantity > 0.001);

    
    // 2. Calculate Today's Positions & P&L
    let positionsDayPnl = 0;
    let misMarginUsed = 0;
    const positionMap: { [ticker: string]: Position } = {};
    
    for (const order of todayExecutedOrders) {
        const ltp = newStocksMap[order.ticker]?.price || order.ltp;
        let p = positionMap[order.ticker];

        if (!p) {
            p = {
                id: `pos-${order.ticker}`, ticker: order.ticker, product: order.product || 'MIS',
                quantity: 0, avgPrice: 0, ltp: ltp, pnl: 0, investedValue: 0, dayChange: newStocksMap[order.ticker]?.change || 0,
                dayChangePercent: newStocksMap[order.ticker]?.changePercent || 0, pnlPercent: 0, type: 'BUY',
            };
            positionMap[order.ticker] = p;
        }
        
        p.ltp = ltp;
        const tradeValue = order.ltp * order.quantity;
        const currentNetQuantity = p.quantity;

        // If it's a sell from holding, it should not be in positions
        if(order.isSellFromHolding) continue;

        if (Math.sign(order.quantity * (order.type === 'BUY' ? 1 : -1)) === Math.sign(currentNetQuantity) || currentNetQuantity === 0) {
            // Same direction, so average out
            const currentAbsQty = Math.abs(currentNetQuantity);
            const newTotalValue = (p.avgPrice * currentAbsQty) + tradeValue;
            p.quantity += order.quantity * (order.type === 'BUY' ? 1 : -1);
            p.avgPrice = Math.abs(p.quantity) > 0 ? newTotalValue / Math.abs(p.quantity) : 0;
        } else {
             // Opposite direction, square off
             p.quantity += order.quantity * (order.type === 'BUY' ? 1 : -1);
             // Avg price remains same for partial square off. if it flips, avgPrice is reset below.
        }

        // If position flips from long to short or vice-versa, the avg price for the new leg is the price of the flipping trade
        if (Math.sign(p.quantity) !== Math.sign(currentNetQuantity) && currentNetQuantity !== 0) {
            p.avgPrice = order.ltp;
        }
    }
    
    let updatedPositions = Object.values(positionMap);

    updatedPositions.forEach(p => {
        p.type = p.quantity > 0 ? 'BUY' : (p.quantity < 0 ? 'SELL' : 'CLOSED');
        const pnl = (p.ltp - p.avgPrice) * p.quantity;
        p.pnl = pnl;
        if(Math.abs(p.quantity) > 0.001) positionsDayPnl += pnl;

        const netQty = Math.abs(p.quantity);
        let investedValueForPos = p.avgPrice * netQty;
        
        if(p.product === 'MIS') {
            const margin = investedValueForPos / 5;
            if(Math.abs(p.quantity) > 0.001) misMarginUsed += margin;
            p.investedValue = margin;
        } else {
             p.investedValue = investedValueForPos;
        }
        
        const liveData = newStocksMap[p.ticker];
        p.dayChange = liveData?.change || 0;
        p.dayChangePercent = liveData?.changePercent || 0;
        p.pnlPercent = p.investedValue > 0 && Math.abs(p.quantity) > 0.001 ? (pnl / p.investedValue) * 100 : 0;
    });

     // AUTO SQUARE OFF LOGIC
    if (isMarketClosedForAutoSquareOff()) {
        const openMISPositions = updatedPositions.filter(p => p.product === 'MIS' && Math.abs(p.quantity) > 0.001);
        if (openMISPositions.length > 0) {
            let newOrdersForSquareOff: Order[] = [];
            openMISPositions.forEach(pos => {
                const liveData = newStocksMap[pos.ticker];
                if (!liveData) return;

                const closingOrder: Order = {
                    id: `auto-sq-off-${Date.now()}-${pos.ticker}`,
                    type: pos.quantity > 0 ? 'SELL' : 'BUY',
                    ticker: pos.ticker,
                    quantity: Math.abs(pos.quantity),
                    filledQuantity: Math.abs(pos.quantity),
                    limitPrice: liveData.price,
                    status: 'Executed',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    exchange: liveData.exchange || 'NSE',
                    orderType: `${pos.product} MARKET`,
                    ltp: liveData.price,
                    isAMO: false,
                    product: pos.product,
                    orderMethod: 'MARKET',
                    executedAt: new Date().toISOString(),
                };
                newOrdersForSquareOff.push(closingOrder);
            });

            if (newOrdersForSquareOff.length > 0) {
                const updatedOrders = [...allOrders, ...newOrdersForSquareOff];
                localStorage.setItem('orders', JSON.stringify(updatedOrders));
                toast({
                    title: "Auto Square-Off",
                    description: `Your open intraday positions have been automatically closed as the market is now closed.`
                });
                // Recalculate everything after adding new orders
                updatePortfolioData(isSilent);
                return; // Exit to avoid setting state with old data
            }
        }
    }


    // 3. Combine for final portfolio view
    const holdingsDayPnl = pastHoldings.reduce((acc, h) => {
        const liveData = newStocksMap[h.ticker];
        if (!liveData) return acc;
        return acc + ((liveData.price - liveData.previousClose) * h.quantity);
    }, 0);

    const totalHoldingsInvested = pastHoldings.reduce((acc, h) => acc + (h.avgPrice * h.quantity), 0);
    const totalHoldingsCurrentValue = pastHoldings.reduce((acc, h) => acc + ((newStocksMap[h.ticker]?.price || h.ltp) * h.quantity), 0);
    
    const dayPnl = holdingsDayPnl + positionsDayPnl;
    const totalInvested = totalHoldingsInvested;
    const totalCurrentValue = totalHoldingsCurrentValue + positionsDayPnl;
    const totalPnl = (totalHoldingsCurrentValue - totalHoldingsInvested) + positionsDayPnl;
    
    const finalHoldings = pastHoldings.map(h => {
        const liveData = newStocksMap[h.ticker];
        const ltp = liveData?.price || h.ltp;
        const invested = h.avgPrice * h.quantity;
        const current = ltp * h.quantity;
        const pnl = current - invested;
        return {
            ...h,
            ltp,
            investedValue: invested,
            currentValue: current,
            pnl,
            pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0,
            dayChange: liveData?.change || 0,
            dayChangePercent: liveData?.changePercent || 0,
        };
    }).filter(h => h.quantity > 0);


    localStorage.setItem('portfolioData', JSON.stringify({ holdings: finalHoldings }));

    const newPortfolio: Portfolio = {
      investedValue: totalInvested,
      currentValue: totalCurrentValue,
      totalPnl: totalPnl,
      totalPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
      dayPnl: dayPnl,
      dayPnlPercent: (totalInvested + misMarginUsed) > 0 ? (dayPnl / (totalInvested + misMarginUsed)) * 100 : 0,
      holdings: finalHoldings,
      positions: updatedPositions.filter(p => Math.abs(p.quantity) > 0.001), // Only show open positions
    };

    setPortfolio(newPortfolio);
    if (!isSilent) setIsLoading(false);
  }, [toast]);


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

  const totalPositionsInvested = useMemo(() => {
    return filteredPositions.reduce((total, pos) => total + (pos.investedValue || 0), 0);
  }, [filteredPositions]);


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
            {isLoading && filteredHoldings.length === 0 ? (
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
                    <span>{holding.quantity.toFixed(2)} Qty.</span>
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
                        <span>Invested {(holding.investedValue || 0).toFixed(2)}</span>
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
          {filteredPositions.length > 0 && (
             <Card className="mb-4">
                <CardContent className="p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Invested</span>
                  <span className="font-semibold">₹{totalPositionsInvested.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                </CardContent>
             </Card>
          )}
          <div className="space-y-2">
             {isLoading && filteredPositions.length === 0 ? (
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
                         <span>Invested {(pos.investedValue || 0).toFixed(2)}</span>
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
    

    




    

    
