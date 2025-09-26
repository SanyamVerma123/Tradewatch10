

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
import { StockActionSheet } from "./StockActionSheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";

const isToday = (someDate: Date) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        someDate.getFullYear() === today.getFullYear();
};

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
    if(day === 0 || day === 6) return true; // Close on weekends for sure
    // After 3:30 PM
    return hours > 15 || (hours === 15 && minutes >= 30);
}


export function PortfolioClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Holdings");
  const [searchTerm, setSearchTerm] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio>({ holdings: [], positions: [], investedValue: 0, currentValue: 0, totalPnl: 0, totalPnlPercent: 0, dayPnl: 0, dayPnlPercent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [stocksMap, setStocksMap] = useState<Record<string, Stock>>({});
  const [user, setUser] = useState<User | null>(null);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [actionSheetContext, setActionSheetContext] = useState<'holding' | 'position' | 'watchlist'>('watchlist');

  const { currencySymbol, market } = useMarket();

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
  
  const updatePortfolioData = useCallback(async () => {
    if (!user) return;
    
    const ordersKey = `orders_${user.id}_${market}`;
    const portfolioKey = `portfolioData_${user.id}_${market}`;
    
    let allOrders: Order[];
    try {
        const ordersItem = localStorage.getItem(ordersKey);
        allOrders = ordersItem ? JSON.parse(ordersItem) : [];
    } catch (e) {
        console.error("Could not parse orders from local storage", e);
        allOrders = [];
    }
    
    const executedOrders = allOrders.filter(o => o.status === 'Executed' && o.executedAt).sort((a, b) => new Date(a.executedAt!).getTime() - new Date(b.executedAt!).getTime());

    const todayExecutedOrders = executedOrders.filter(o => isToday(new Date(o.executedAt!)));
    const previousDaysExecutedOrders = executedOrders.filter(o => !isToday(new Date(o.executedAt!)));
    
    const allTickersInOrders = [...new Set(allOrders.map(o => o.ticker))];
    const initialPortfolioData = { holdings: [], positions: [], investedValue: 0, currentValue: 0, totalPnl: 0, totalPnlPercent: 0, dayPnl: 0, dayPnlPercent: 0 };


    if (allTickersInOrders.length === 0) {
      setPortfolio(initialPortfolioData);
      setIsLoading(false);
      localStorage.setItem(portfolioKey, JSON.stringify(initialPortfolioData));
      return;
    }
    
    setIsLoading(true);
    const stockData = await getStockData(allTickersInOrders);
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    // ==========================================================
    // HOLDINGS CALCULATION (Only previous day's CNC orders)
    // ==========================================================
    const holdingsMap: { [ticker: string]: Holding } = {};
    const previousCncOrders = previousDaysExecutedOrders.filter(o => o.product === 'CNC');

    for (const order of previousCncOrders) {
        let holding = holdingsMap[order.ticker];
        
        if (!holding) {
             holding = {
                id: `holding-${order.ticker}`, ticker: order.ticker, quantity: 0, avgPrice: 0, investedValue: 0, ltp: 0, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0,
            };
            holdingsMap[order.ticker] = holding;
        }

        const tradeValue = order.ltp * order.quantity;

        if (order.type === 'BUY') {
            const newTotalValue = (holding.avgPrice * holding.quantity) + tradeValue;
            holding.quantity += order.quantity;
            holding.avgPrice = holding.quantity > 0 ? newTotalValue / holding.quantity : 0;
        } else { // SELL
            holding.quantity -= order.quantity;
        }
    }

    // Process today's sales from holdings
    const todayCncSellOrders = todayExecutedOrders.filter(o => o.product === 'CNC' && o.type === 'SELL');
    for (const order of todayCncSellOrders) {
        if(holdingsMap[order.ticker]){
            holdingsMap[order.ticker].quantity -= order.quantity;
        }
    }

    const currentHoldings = Object.values(holdingsMap).filter(h => h.quantity > 0.001);
    
    // ==========================================================
    // POSITIONS CALCULATION (Only today's orders)
    // ==========================================================
    let realizedDayPnl = 0;
    const positionMap: { [compositeKey: string]: Position } = {};
    
    for (const order of todayExecutedOrders) {
        const ltp = newStocksMap[order.ticker]?.price || order.ltp;
        const product = order.product || 'CNC';
        const compositeKey = `${order.ticker}-${product}`;
        
        let p = positionMap[compositeKey];
        if (!p) {
            p = {
                id: `pos-${compositeKey}`, ticker: order.ticker, product: product, quantity: 0, avgPrice: 0, ltp: ltp, pnl: 0, investedValue: 0, dayChange: newStocksMap[order.ticker]?.change || 0, dayChangePercent: newStocksMap[order.ticker]?.changePercent || 0, pnlPercent: 0, type: 'BUY',
            };
            positionMap[compositeKey] = p;
        }
        
        p.ltp = ltp;
        const tradeValue = order.ltp * order.quantity;
        const currentNetQuantity = p.quantity;
        const tradeSign = order.type === 'BUY' ? 1 : -1;

        if (Math.sign(tradeSign) === Math.sign(currentNetQuantity) || currentNetQuantity === 0) {
            const newTotalValue = (p.avgPrice * Math.abs(currentNetQuantity)) + tradeValue;
            p.quantity += order.quantity * tradeSign;
            p.avgPrice = Math.abs(p.quantity) > 0 ? newTotalValue / Math.abs(p.quantity) : 0;
        } else {
             const qtyToSquareOff = Math.min(Math.abs(currentNetQuantity), order.quantity);
             const pnlFromTrade = (order.ltp - p.avgPrice) * qtyToSquareOff * -Math.sign(currentNetQuantity);
             realizedDayPnl += pnlFromTrade;
             p.quantity += order.quantity * tradeSign;
             
             if (Math.abs(p.quantity) < 0.001) {
                 p.quantity = 0;
                 p.avgPrice = 0;
             } else if (Math.sign(p.quantity) !== Math.sign(currentNetQuantity)) {
                // Flipped position
                p.avgPrice = order.ltp;
            }
        }
    }
    
    let updatedPositions = Object.values(positionMap);

    updatedPositions.forEach(p => {
        p.type = p.quantity > 0 ? 'BUY' : (p.quantity < 0 ? 'SELL' : 'CLOSED');
        const unrealizedPnl = (p.ltp - p.avgPrice) * p.quantity;
        p.pnl = unrealizedPnl;
    });
    
    if (isMarketClosedForAutoSquareOff()) {
        const openMISPositions = updatedPositions.filter(p => p.product === 'MIS' && Math.abs(p.quantity) > 0.001);
        if (openMISPositions.length > 0) {
            let newOrdersForSquareOff: Order[] = [];
            let didSquareOff = false;
            openMISPositions.forEach(pos => {
                const liveData = newStocksMap[pos.ticker];
                if (!liveData) return;
                
                const realizedPnlOnSquareOff = (liveData.price - pos.avgPrice) * pos.quantity;

                const closingOrder: Order = {
                    id: `auto-sq-off-${Date.now()}-${pos.ticker}`, type: pos.quantity > 0 ? 'SELL' : 'BUY', ticker: pos.ticker, quantity: Math.abs(pos.quantity), filledQuantity: Math.abs(pos.quantity), limitPrice: liveData.price, status: 'Executed', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), exchange: liveData.exchange || 'NSE', orderType: `${pos.product} MARKET`, ltp: liveData.price, isAMO: false, product: pos.product, orderMethod: 'MARKET', executedAt: new Date().toISOString(), realizedPnl: realizedPnlOnSquareOff
                };
                
                // Avoid re-adding the same square-off order
                if (!allOrders.some(o => o.id.startsWith('auto-sq-off') && o.ticker === pos.ticker)) {
                    newOrdersForSquareOff.push(closingOrder);
                    didSquareOff = true;
                }
            });

            if (didSquareOff) {
                const updatedOrders = [...allOrders, ...newOrdersForSquareOff];
                localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
                toast({ title: "Auto Square-Off", description: `Your open intraday positions have been automatically closed.` });
                updatePortfolioData(); // Re-run to update portfolio state
                return;
            }
        }
    }

    const finalHoldings = currentHoldings.map(h => {
        const liveData = newStocksMap[h.ticker];
        const ltp = liveData?.price || h.ltp;
        const invested = h.avgPrice * h.quantity;
        const current = ltp * h.quantity;
        const pnl = current - invested;
        return { ...h, ltp, investedValue: invested, currentValue: current, pnl, pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0, dayChange: liveData?.change || 0, dayChangePercent: liveData?.changePercent || 0, };
    }).filter(h => h.quantity > 0);

    const openPositions = updatedPositions.filter(p => Math.abs(p.quantity) > 0.001);

    const newPortfolio: Portfolio = {
      ...initialPortfolioData,
      holdings: finalHoldings,
      positions: openPositions,
    };

    setPortfolio(newPortfolio);
    setIsLoading(false);
  }, [toast, user, market]);


  const lightweightUpdate = useCallback(async (currentPortfolio: Portfolio) => {
    if (!user || (!currentPortfolio.holdings.length && !currentPortfolio.positions.length)) return;
    
    const tickers = [...new Set([...currentPortfolio.holdings.map(h => h.ticker), ...currentPortfolio.positions.map(p => p.ticker)])];
    if (tickers.length === 0) return;

    const stockData = await getStockData(tickers);
    const newStocksMap: Record<string, Stock> = {};
    stockData.forEach(s => newStocksMap[s.ticker] = s);
    setStocksMap(newStocksMap);

    let totalHoldingsInvested = 0;
    let totalHoldingsCurrentValue = 0;
    let holdingsDayPnl = 0;

    const updatedHoldings = currentPortfolio.holdings.map(h => {
        const liveData = newStocksMap[h.ticker];
        const ltp = liveData?.price || h.ltp;
        const invested = h.avgPrice * h.quantity;
        const current = ltp * h.quantity;
        const pnl = current - invested;
        
        totalHoldingsInvested += invested;
        totalHoldingsCurrentValue += current;
        if(liveData) {
            holdingsDayPnl += (liveData.price - liveData.previousClose) * h.quantity;
        }

        return { ...h, ltp, investedValue: invested, currentValue: current, pnl, pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0, dayChange: liveData?.change || 0, dayChangePercent: liveData?.changePercent || 0, };
    });

    let openPositionsUnrealizedPnl = 0;
    let totalPositionsInvested = 0;

    const updatedPositions = currentPortfolio.positions.map(p => {
        const liveData = newStocksMap[p.ticker];
        const ltp = liveData?.price || p.ltp;
        const unrealizedPnl = (ltp - p.avgPrice) * p.quantity;
        openPositionsUnrealizedPnl += unrealizedPnl;

        const investedValueForPos = p.avgPrice * Math.abs(p.quantity);
        const margin = p.product === 'MIS' ? investedValueForPos / 5 : investedValueForPos;
        totalPositionsInvested += margin;

        return { ...p, ltp, pnl: unrealizedPnl, investedValue: margin, dayChange: liveData?.change || 0, dayChangePercent: liveData?.changePercent || 0, pnlPercent: margin > 0 ? (unrealizedPnl / margin) * 100 : 0, };
    });

    // Realized PNL needs to be fetched from orders to be accurate in summary
    const ordersKey = `orders_${user.id}_${market}`;
    let allOrders: Order[] = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const todayAllRealizedPnl = allOrders.filter(o => o.status === 'Executed' && o.executedAt && isToday(new Date(o.executedAt)) && o.realizedPnl !== undefined).reduce((acc, o) => acc + (o.realizedPnl || 0), 0);

    const dayPnl = holdingsDayPnl + todayAllRealizedPnl + openPositionsUnrealizedPnl;
    const totalInvested = totalHoldingsInvested; // Only holdings contribute to the main invested value
    const totalPnl = (totalHoldingsCurrentValue - totalHoldingsInvested) + todayAllRealizedPnl + openPositionsUnrealizedPnl;
    
    setPortfolio({
        investedValue: totalInvested,
        currentValue: totalHoldingsCurrentValue,
        totalPnl: totalPnl,
        totalPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
        dayPnl: dayPnl,
        dayPnlPercent: (totalInvested + totalPositionsInvested) > 0 ? (dayPnl / (totalInvested + totalPositionsInvested)) * 100 : 0,
        holdings: updatedHoldings,
        positions: updatedPositions,
    });

    // Write the latest portfolio totals to localStorage for other pages to use
    const portfolioKey = `portfolioData_${user.id}_${market}`;
    const portfolioSummary = { 
        investedValue: totalInvested, 
        currentValue: totalHoldingsCurrentValue,
        totalPnl: totalPnl,
    };
    localStorage.setItem(portfolioKey, JSON.stringify(portfolioSummary));


  }, [user, market]);

  useEffect(() => {
    if (!user) return;
    updatePortfolioData(); // Initial heavy load
    
    const ordersKey = `orders_${user.id}_${market}`;
    const handleStorageChange = (event: StorageEvent) => {
      if ((event.key === ordersKey)) {
        updatePortfolioData(); // Re-run heavy calculation on order change
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updatePortfolioData, user, market]);

  useEffect(() => {
    if (isLoading) return; // Don't start interval until initial load is done
    const interval = setInterval(() => lightweightUpdate(portfolio), 5000);
    return () => clearInterval(interval);
  }, [isLoading, portfolio, lightweightUpdate]);

  const handleHoldingClick = (holding: Holding) => {
    const stockData = stocksMap[holding.ticker];
    if (stockData) {
      setSelectedStock({...stockData, product: 'CNC'});
      setActionSheetContext('holding');
      setIsActionSheetOpen(true);
    }
  };

  const handlePositionClick = (position: Position) => {
     const stockData = stocksMap[position.ticker];
    if (stockData) {
      setSelectedStock({ ...stockData, product: position.product as 'MIS' | 'CNC' });
      setActionSheetContext('position');
      setIsActionSheetOpen(true);
    }
  }

  const onActionSheetTrade = (action: 'add' | 'exit', ticker: string) => {
     if (!selectedStock) return;

     let orderData: Partial<Order> = { ticker };
     
     if (actionSheetContext === 'holding') {
        const holding = portfolio.holdings.find(h => h.ticker === ticker);
        if (!holding) return;
        
        orderData.product = 'CNC';
        
        if (action === 'exit') {
            orderData.type = 'SELL';
            orderData.quantity = holding.quantity;
            orderData.isExit = true;
        } else { // 'add'
            orderData.type = 'BUY';
            orderData.isAdding = true;
        }
     } else if (actionSheetContext === 'position') {
        const position = portfolio.positions.find(p => p.ticker === ticker && p.product === selectedStock.product);
        if (!position) return;
        
        orderData.product = position.product;
        
        if (action === 'exit') {
            // Exiting a long position is SELL, exiting a short is BUY
            orderData.type = position.quantity > 0 ? 'SELL' : 'BUY'; 
            orderData.quantity = Math.abs(position.quantity);
            orderData.isExit = true;
        } else { // 'add'
            // Adding to a long position is BUY, adding to short is SELL
            orderData.type = position.quantity > 0 ? 'BUY' : 'SELL';
            orderData.isAdding = true;
        }
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
                    <div className="text-lg font-semibold">{currencySymbol}{(portfolio.investedValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                    <div className="text-sm text-muted-foreground">Current</div>
                    <div className="text-lg font-semibold">{currencySymbol}{(portfolio.currentValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div>
                    <div className="text-sm text-muted-foreground">Overall P&L</div>
                    <div className={cn("text-lg font-semibold", portfolio.totalPnl >= 0 ? "text-positive" : "text-destructive")}>
                        {portfolio.totalPnl >= 0 ? '+' : ''}{currencySymbol}{(portfolio.totalPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div>
                    <div className="text-sm text-muted-foreground">Day's P&L</div>
                    <div className={cn("text-lg font-semibold", portfolio.dayPnl >= 0 ? "text-positive" : "text-destructive")}>
                        {portfolio.dayPnl >= 0 ? '+' : ''}{currencySymbol}{(portfolio.dayPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
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
                  <span className="font-semibold">{currencySymbol}{totalPositionsInvested.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
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
                         <span>Margin {(pos.investedValue || 0).toFixed(2)}</span>
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
        tradeButtonVariant={actionSheetContext === 'watchlist' ? 'long-short' : 'add-exit'}
      />
    </div>
  );
}

    