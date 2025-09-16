

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
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  const [user, setUser] = useState<User | null>(null);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
      } else {
        setUser(sbUser);
      }
    };
    fetchUser();
  }, [router]);
  
  const updatePortfolioData = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setIsLoading(true);
    
    const ordersKey = `orders_${user.id}`;
    const portfolioKey = `portfolioData_${user.id}`;
    
    let allOrders: Order[];
    try {
        const ordersItem = localStorage.getItem(ordersKey);
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
      const storedPortfolio = JSON.parse(localStorage.getItem(portfolioKey) || '{}');
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
      localStorage.setItem(portfolioKey, JSON.stringify({ holdings: [], positions: [] }));
      return;
    }
    
    const stockData = await getStockData(allTickers);
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    // 1. Calculate Historical holdings from ALL CNC trades up to yesterday
    const holdingsMap: { [ticker: string]: Holding } = {};
    const pastCncOrders = executedOrders.filter(o => (o.product === 'CNC' || o.isSellFromHolding) && !isToday(new Date(o.executedAt!)));

    for (const order of pastCncOrders) {
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

    const pastHoldings = Object.values(holdingsMap).filter(h => h.quantity > 0.001);

    
    // 2. Calculate Today's Positions & P&L
    let realizedDayPnl = 0;
    let misMarginUsed = 0;
    const positionMap: { [compositeKey: string]: Position } = {};
    
    for (const order of todayExecutedOrders) {
        const ltp = newStocksMap[order.ticker]?.price || order.ltp;
        const product = order.product || 'MIS';
        
        const compositeKey = `${order.ticker}-${product}`;
        
        let p = positionMap[compositeKey];

        if (!p) {
            p = {
                id: `pos-${compositeKey}`, ticker: order.ticker, product: product,
                quantity: 0, avgPrice: 0, ltp: ltp, pnl: 0, investedValue: 0, dayChange: newStocksMap[order.ticker]?.change || 0,
                dayChangePercent: newStocksMap[order.ticker]?.changePercent || 0, pnlPercent: 0, type: 'BUY',
            };
            positionMap[compositeKey] = p;
        }
        
        p.ltp = ltp;
        const tradeValue = order.ltp * order.quantity;
        const currentNetQuantity = p.quantity;
        const tradeSign = order.type === 'BUY' ? 1 : -1;

        if (order.isSellFromHolding) {
            const holding = pastHoldings.find(h => h.ticker === order.ticker);
            if(holding) {
                realizedDayPnl += (order.ltp - holding.avgPrice) * order.quantity;
            }
            continue;
        };

        if (Math.sign(tradeSign) === Math.sign(currentNetQuantity) || currentNetQuantity === 0) {
            // Averaging: trade in the same direction
            const newTotalValue = (p.avgPrice * Math.abs(currentNetQuantity)) + tradeValue;
            p.quantity += order.quantity * tradeSign;
            p.avgPrice = Math.abs(p.quantity) > 0 ? newTotalValue / Math.abs(p.quantity) : 0;
        } else {
             // Closing/Reversing: trade in the opposite direction
             const qtyToSquareOff = Math.min(Math.abs(currentNetQuantity), order.quantity);
             realizedDayPnl += (order.ltp - p.avgPrice) * qtyToSquareOff * -Math.sign(currentNetQuantity);
             p.quantity += order.quantity * tradeSign;
             
             if (Math.sign(p.quantity) !== Math.sign(currentNetQuantity)) {
                // Position has flipped (e.g., from long to short)
                p.avgPrice = order.ltp;
            }
        }
    }
    
    let updatedPositions = Object.values(positionMap);

    updatedPositions.forEach(p => {
        p.type = p.quantity > 0 ? 'BUY' : (p.quantity < 0 ? 'SELL' : 'CLOSED');
        const unrealizedPnl = (p.ltp - p.avgPrice) * p.quantity;
        p.pnl = unrealizedPnl;

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
        p.pnlPercent = p.investedValue > 0 && Math.abs(p.quantity) > 0.001 ? (unrealizedPnl / p.investedValue) * 100 : 0;
    });
    
    const openPositionsUnrealizedPnl = updatedPositions.reduce((acc, p) => acc + p.pnl, 0);


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
                localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
                toast({
                    title: "Auto Square-Off",
                    description: `Your open intraday positions have been automatically closed as the market is now closed.`
                });
                updatePortfolioData(isSilent);
                return;
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
    
    const dayPnl = holdingsDayPnl + realizedDayPnl + openPositionsUnrealizedPnl;
    const totalInvested = totalHoldingsInvested;
    const totalHoldingsPnl = totalHoldingsCurrentValue - totalHoldingsInvested;
    const totalPnl = totalHoldingsPnl + realizedDayPnl + openPositionsUnrealizedPnl;
    const currentValue = totalHoldingsCurrentValue + realizedDayPnl + openPositionsUnrealizedPnl;
    
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

    // Store the calculated realized PnL in the order itself
    allOrders.forEach(order => {
        if (order.status === 'Executed' && order.type === 'SELL') {
            const pos = updatedPositions.find(p => p.ticker === order.ticker && p.product === order.product);
            if (pos && order.realizedPnl === undefined) {
                 order.realizedPnl = realizedDayPnl;
            }
        }
    });
    localStorage.setItem(ordersKey, JSON.stringify(allOrders));


    localStorage.setItem(portfolioKey, JSON.stringify({ holdings: finalHoldings }));

    const newPortfolio: Portfolio = {
      investedValue: totalInvested,
      currentValue: currentValue,
      totalPnl: totalPnl,
      totalPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
      dayPnl: dayPnl,
      dayPnlPercent: (totalInvested + misMarginUsed) > 0 ? (dayPnl / (totalInvested + misMarginUsed)) * 100 : 0,
      holdings: finalHoldings,
      positions: updatedPositions.filter(p => Math.abs(p.quantity) > 0.001),
    };

    setPortfolio(newPortfolio);
    if (!isSilent) setIsLoading(false);
  }, [toast, user]);


  useEffect(() => {
    if (!user) return;
    updatePortfolioData();
    const interval = setInterval(() => updatePortfolioData(true), 5000);
    
    const handleStorageChange = (event: StorageEvent) => {
      if ((event.key === `portfolioData_${user.id}` || event.key === `orders_${user.id}`)) {
        updatePortfolioData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updatePortfolioData, user]);

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
     const stock = stocksMap[ticker];
     let orderData: Partial<Order>;

     if (isFromHolding) { // Action is on a holding
        const holding = portfolio.holdings.find(h => h.ticker === ticker);
        orderData = {
            type: type.toUpperCase() as 'BUY' | 'SELL',
            ticker: ticker,
            quantity: type === 'sell' ? holding?.quantity : 1,
            product: 'CNC', // Holdings are always CNC
            orderMethod: 'MARKET',
            ltp: stock?.price || 0,
            price: stock?.price?.toFixed(2) || '0',
            isSellFromHolding: type === 'sell',
        };
     } else { // Action is on a position
        const position = portfolio.positions.find(p => p.ticker === ticker && p.id.endsWith(`-${p.product}`));
        orderData = {
            type: type.toUpperCase() as 'BUY' | 'SELL',
            ticker: ticker,
            quantity: type === 'sell' ? Math.abs(position?.quantity || 0) : 1,
            product: position?.product as 'CNC' | 'MIS', // Match the position's product type
            orderMethod: 'MARKET',
            ltp: stock?.price || 0,
            price: stock?.price?.toFixed(2) || '0',
        };
     }
     
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
                        <span className="font-bold text-foreground">{pos.product}</span>
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
        tradeButtonVariant="add-exit"
        isFromHolding={activeTab === 'Holdings'}
      />
    </div>
  );
}
