
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
    setIsLoading(true);

    try {
        const { data: allOrders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .eq('market', market);

        if (ordersError) throw ordersError;

        const executedOrders = allOrders.filter(o => o.status === 'Executed' && o.executed_at).sort((a, b) => new Date(a.executed_at!).getTime() - new Date(b.executed_at!).getTime());
        const allTickersInOrders = [...new Set(allOrders.map(o => o.ticker))];
        const initialPortfolioData = { holdings: [], positions: [], investedValue: 0, currentValue: 0, totalPnl: 0, totalPnlPercent: 0, dayPnl: 0, dayPnlPercent: 0 };

        if (allTickersInOrders.length === 0) {
            setPortfolio(initialPortfolioData);
            setIsLoading(false);
            return;
        }

        const stockData = await getStockData(allTickersInOrders);
        const newStocksMap: Record<string, Stock> = {};
        stockData.forEach(s => newStocksMap[s.ticker] = s);
        setStocksMap(newStocksMap);

        const holdingsMap: { [ticker: string]: Holding } = {};
        const positionMap: { [compositeKey: string]: Position } = {};

        // Process all executed orders chronologically
        for (const order of executedOrders) {
            const ltp = newStocksMap[order.ticker]?.price || order.ltp;
            const product = order.product || 'CNC';
            const tradeValue = order.ltp * order.quantity;

            // CNC Holdings Logic
            if (product === 'CNC') {
                let h = holdingsMap[order.ticker];
                if (!h) {
                    h = { id: `holding-${order.ticker}`, ticker: order.ticker, quantity: 0, avgPrice: 0, investedValue: 0, ltp: 0, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0 };
                    holdingsMap[order.ticker] = h;
                }

                if (order.type === 'BUY') {
                    const newTotalValue = (h.avgPrice * h.quantity) + tradeValue;
                    h.quantity += order.quantity;
                    h.avgPrice = h.quantity > 0 ? newTotalValue / h.quantity : 0;
                } else { // SELL
                    h.quantity -= order.quantity;
                }
            }
            
            // Intraday (MIS) Positions & NEW CNC Buy Positions for the day
            if (product === 'MIS' || (product === 'CNC' && order.type === 'BUY' && isToday(new Date(order.executed_at!)))) {
                const compositeKey = `${order.ticker}-${product}`;
                let p = positionMap[compositeKey];
                if (!p) {
                    p = { id: `pos-${compositeKey}`, ticker: order.ticker, product: product, quantity: 0, avgPrice: 0, ltp: ltp, pnl: 0, investedValue: 0, dayChange: newStocksMap[order.ticker]?.change || 0, dayChangePercent: newStocksMap[order.ticker]?.changePercent || 0, pnlPercent: 0, type: 'BUY' };
                    positionMap[compositeKey] = p;
                }
                
                p.ltp = ltp;
                const tradeSign = order.type === 'BUY' ? 1 : -1;
                
                const currentNetQuantity = p.quantity;
                p.quantity += order.quantity * tradeSign;

                 if (Math.sign(tradeSign) === Math.sign(currentNetQuantity) || currentNetQuantity === 0) {
                    const newTotalValue = (p.avgPrice * Math.abs(currentNetQuantity)) + tradeValue;
                    p.avgPrice = Math.abs(p.quantity) > 0 ? newTotalValue / Math.abs(p.quantity) : 0;
                }
            }
        }
        
        const finalHoldings = Object.values(holdingsMap)
          .filter(h => h.quantity > 0.001)
          .map(h => {
                const liveData = newStocksMap[h.ticker];
                const ltp = liveData?.price || h.ltp;
                const invested = h.avgPrice * h.quantity;
                const current = ltp * h.quantity;
                const pnl = current - invested;
                return { ...h, ltp, investedValue: invested, currentValue: current, pnl, pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0, dayChange: liveData?.change || 0, dayChangePercent: liveData?.changePercent || 0, };
          });


        const finalPositions = Object.values(positionMap)
          .filter(p => Math.abs(p.quantity) > 0.001)
          .map(p => {
              p.type = p.quantity > 0 ? 'BUY' : 'SELL';
              const unrealizedPnl = (p.ltp - p.avgPrice) * p.quantity;
              p.pnl = unrealizedPnl;
              return p;
          });

        setPortfolio({ ...initialPortfolioData, holdings: finalHoldings, positions: finalPositions });

    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not calculate portfolio.' });
    } finally {
      setIsLoading(false);
    }
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

    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('realized_pnl')
        .eq('user_id', user.id)
        .eq('market', market)
        .eq('status', 'Executed')
        .not('realized_pnl', 'is', null)
        .gte('executed_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
        
    const todayAllRealizedPnl = ordersData?.reduce((acc, o) => acc + (o.realized_pnl || 0), 0) || 0;


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

  }, [user, market, supabase]);

  useEffect(() => {
    if (!user) return;
    updatePortfolioData(); // Initial heavy load
    
    const channel = supabase.channel(`portfolio_orders_channel_${user.id}`)
      .on<Order>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
           updatePortfolioData(); // Refetch all orders on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
            orderData.is_exit = true;
        } else { // 'add'
            orderData.type = 'BUY';
            orderData.is_adding = true;
        }
     } else if (actionSheetContext === 'position') {
        const position = portfolio.positions.find(p => p.ticker === ticker && p.product === selectedStock.product);
        if (!position) return;
        
        orderData.product = position.product;
        
        if (action === 'exit') {
            // Exiting a long position is SELL, exiting a short is BUY
            orderData.type = position.quantity > 0 ? 'SELL' : 'BUY'; 
            orderData.quantity = Math.abs(position.quantity);
            orderData.is_exit = true;
        } else { // 'add'
            // Adding to a long position is BUY, adding to short is SELL
            orderData.type = position.quantity > 0 ? 'BUY' : 'SELL';
            orderData.is_adding = true;
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
