

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Stock, Watchlist, NewsArticle, Order } from "@/lib/types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { getStockData, searchStocks, getStockOfTheDayAction, getMarketNews } from "@/app/actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Search, Sparkles, Users, Loader2, PlusCircle, X, Newspaper, TrendingUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { watchlists as initialWatchlistsData } from "@/lib/data";
import { StockActionSheet } from "./StockActionSheet";
import { AIAnalysisDialog } from "./AIAnalysisDialog";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";


const getStockStatusMessage = (changePercent: number): string => {
    if (changePercent > 1.5) return "Strong upward momentum today.";
    if (changePercent > 0.5) return "Showing positive signs.";
    if (changePercent > 0) return "Trading slightly higher.";
    if (changePercent < -1.5) return "Facing significant selling pressure.";
    if (changePercent < -0.5) return "Currently on a downward trend.";
    if (changePercent < 0) return "Seeing a slight dip in price.";
    return "Market appears stable for this stock.";
};

type StockOfTheDay = Awaited<ReturnType<typeof getStockOfTheDayAction>>;


export function WatchlistDashboard() {
  const router = useRouter();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const { toast } = useToast();
  const [stocks, setStocks] = useState<Record<string, Stock>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ticker: string, name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const [isSeeMoreNewsOpen, setIsSeeMoreNewsOpen] = useState(false);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null);
  const [editingWatchlistName, setEditingWatchlistName] = useState("");
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [stockOfTheDay, setStockOfTheDay] = useState<StockOfTheDay>(null);
  
  const { market, currencySymbol } = useMarket();

  const activeWatchlist = useMemo(() => {
    return watchlists.find((w) => w.id === activeTab);
  }, [activeTab, watchlists]);

  const fetchWatchlists = useCallback(async (sbUser: User) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('watchlists')
      .select('id, name, stock_tickers')
      .eq('user_id', sbUser.id)
      .eq('market', market);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch watchlists.' });
      setWatchlists([]);
    } else if (data) {
      const formattedWatchlists: Watchlist[] = data.map(wl => ({
        id: wl.id.toString(),
        name: wl.name,
        stocks: wl.stock_tickers || [],
      }));

      if (formattedWatchlists.length > 0) {
        setWatchlists(formattedWatchlists);
        if (!activeTab || !formattedWatchlists.some(w => w.id === activeTab)) {
          setActiveTab(formattedWatchlists[0].id);
        }
      } else {
        // No watchlists found for this user/market, create default ones
        const defaultWatchlists = initialWatchlistsData[market].map((wl, index) => ({
            ...wl,
            id: `default-${market}-${index}` // temporary id
        }));

        const watchlistsToInsert = defaultWatchlists.map(wl => ({
            user_id: sbUser.id,
            market: market,
            name: wl.name,
            stock_tickers: wl.stocks,
        }));
        
        const { data: inserted, error: insertError } = await supabase.from('watchlists').insert(watchlistsToInsert).select();
        
        if (insertError) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not create default watchlists.' });
        } else if (inserted) {
            const newFormattedWatchlists: Watchlist[] = inserted.map(wl => ({
                id: wl.id.toString(),
                name: wl.name,
                stocks: wl.stock_tickers || [],
            }));
            setWatchlists(newFormattedWatchlists);
            setActiveTab(newFormattedWatchlists[0].id);
        }
      }
    }
    setIsLoading(false);
  }, [market, toast, activeTab]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);
      fetchWatchlists(sbUser);
    };
    init();
  }, [router, fetchWatchlists]);

  const loadNewsFromCache = useCallback(async () => {
    if (!user) return;
    const newsCacheKey = `newsCache_${user.id}_${market}`;
    const cachedNewsData = localStorage.getItem(newsCacheKey);
    
    if (cachedNewsData) {
        const { date, articles } = JSON.parse(cachedNewsData);
        const today = new Date().toDateString();
        if (date !== today) {
            localStorage.removeItem(newsCacheKey);
            setNews([]);
        } else {
            setNews(articles);
        }
    } else {
        const liveNews = await getMarketNews(market);
        if(liveNews) {
            setNews(liveNews as NewsArticle[]);
            const newsCache = { date: new Date().toDateString(), articles: liveNews };
            localStorage.setItem(newsCacheKey, JSON.stringify(newsCache));
        } else {
            setNews([]);
        }
    }
  }, [user, market]);

  useEffect(() => {
    loadNewsFromCache();

    const handleStorageChange = (event: StorageEvent) => {
        if (user && event.key === `newsCache_${user.id}_${market}`) {
            loadNewsFromCache();
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, loadNewsFromCache, market]);

  const fetchStockData = useCallback(async (isSilent = false) => {
    if (!activeWatchlist || activeWatchlist.stocks.length === 0) {
      setStocks({});
      setIsLoading(false);
      return;
    }
    if (!isSilent) setIsLoading(true);
    try {
      const data = await getStockData(activeWatchlist.stocks);
      setStocks(prevStocks => {
        const newStocks = { ...prevStocks };
        data.forEach(stock => {
            newStocks[stock.ticker] = stock;
        });
        return newStocks;
      });
    } catch (error) {
      console.error("Failed to fetch stock data", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch watchlist data." });
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [activeWatchlist, toast]);

  useEffect(() => {
    if (activeWatchlist) {
      fetchStockData();
      const interval = setInterval(() => fetchStockData(true), 5000);
      return () => clearInterval(interval);
    }
  }, [activeWatchlist, fetchStockData]);

  useEffect(() => {
    const fetchStockOfTheDay = async () => {
        const result = await getStockOfTheDayAction();
        setStockOfTheDay(result);
    }
    fetchStockOfTheDay();
  }, [])

  const filteredStocks = useMemo(() => {
    if (!activeWatchlist) return [];
    return activeWatchlist.stocks
        .map(ticker => stocks[ticker])
        .filter(Boolean);
  }, [stocks, activeWatchlist]);

  const handleSearchQueryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 1) {
      setIsSearching(true);
      const results = await searchStocks(e.target.value, market);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const addStockToWatchlist = async (ticker: string) => {
    if (!activeWatchlist || !user) return;
    if (activeWatchlist.stocks.includes(ticker)) {
      toast({ description: `${ticker} is already in this watchlist.` });
      return;
    }

    const newStockTickers = [...activeWatchlist.stocks, ticker];
    const { error } = await supabase
      .from('watchlists')
      .update({ stock_tickers: newStockTickers })
      .eq('id', activeWatchlist.id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add stock.' });
    } else {
      setWatchlists(watchlists.map(wl => wl.id === activeWatchlist.id ? { ...wl, stocks: newStockTickers } : wl));
      toast({ title: 'Stock Added', description: `${ticker} added to "${activeWatchlist.name}".` });
      fetchStockData();
    }
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
  };
  
  const removeStockFromWatchlist = async (ticker: string) => {
    if (!activeWatchlist || !user) return;
    
    const newStockTickers = activeWatchlist.stocks.filter(s => s !== ticker);
    const { error } = await supabase
        .from('watchlists')
        .update({ stock_tickers: newStockTickers })
        .eq('id', activeWatchlist.id);

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not remove stock.' });
    } else {
        setWatchlists(watchlists.map(wl => wl.id === activeWatchlist.id ? { ...wl, stocks: newStockTickers } : wl));
        toast({ title: 'Stock Removed', description: `${ticker} removed from "${activeWatchlist.name}".` });
    }
  };


  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim() || !user) {
      toast({ variant: "destructive", title: "Error", description: "Watchlist name cannot be empty." });
      return;
    }
    
    const { data, error } = await supabase
      .from('watchlists')
      .insert({ user_id: user.id, name: newWatchlistName, stock_tickers: [], market: market })
      .select()
      .single();

    if (error) {
      toast({ variant: "destructive", title: 'Error', description: 'Could not create watchlist.' });
    } else if (data) {
      const newWl: Watchlist = { id: data.id.toString(), name: data.name, stocks: data.stock_tickers || [] };
      setWatchlists([...watchlists, newWl]);
      setActiveTab(newWl.id);
      setNewWatchlistName("");
    }
  };

  const handleStockClick = (stock: Stock) => {
    setSelectedStock(stock);
    setIsActionSheetOpen(true);
  }

  const handleTradeAction = (action: 'buy' | 'sell', ticker: string) => {
    const stock = stocks[ticker];
    if (!stock) return;
    
    const isShortSell = action === 'sell';

    const orderData: Partial<Order> = {
        type: isShortSell ? 'SELL' : 'BUY',
        ticker: ticker,
        product: isShortSell ? 'MIS' : undefined,
        isShortSell: isShortSell,
    };
    router.push(`/trade/${encodeURIComponent(ticker)}?order=${encodeURIComponent(JSON.stringify(orderData))}`);
    setIsActionSheetOpen(false);
  }

  const handleStartEditing = (watchlist: Watchlist) => {
    setEditingWatchlistId(watchlist.id);
    setEditingWatchlistName(watchlist.name);
  };

  const handleSaveWatchlistName = async () => {
    if (!editingWatchlistId || !editingWatchlistName.trim() || !user) {
        setEditingWatchlistId(null);
        return;
    };
    
    const { error } = await supabase
        .from('watchlists')
        .update({ name: editingWatchlistName })
        .eq('id', editingWatchlistId);

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not rename watchlist.' });
    } else {
        setWatchlists(watchlists.map(wl => wl.id === editingWatchlistId ? { ...wl, name: editingWatchlistName } : wl));
        toast({ title: "Watchlist Renamed", description: `Successfully renamed to "${editingWatchlistName}".` });
    }
    setEditingWatchlistId(null);
  };

  const handleEditingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveWatchlistName();
    }
    if (e.key === 'Escape') {
      setEditingWatchlistId(null);
    }
  };


  const renderStockSkeleton = () => (
    [...Array(3)].map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={3}>
           <div className="flex justify-between items-center">
             <div>
                <Skeleton className="h-5 w-20 mb-1" />
                <Skeleton className="h-4 w-24" />
             </div>
             <div className="text-right">
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-4 w-24 mt-1 ml-auto" />
            </div>
           </div>
        </TableCell>
      </TableRow>
    ))
  );
  
  const currentStockForSheet = selectedStock ? stocks[selectedStock.ticker] : null;

  if (isLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlists</h1>
        <div className="flex items-center gap-2">
            <Link href="/community">
            <Button variant="ghost" size="icon">
                <Users className="h-5 w-5" />
                <span className="sr-only">Community</span>
            </Button>
            </Link>
        </div>
      </header>

      {stockOfTheDay && (
        <Card className="mb-6 bg-gradient-to-r from-primary/80 to-primary text-primary-foreground shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-bold text-lg">Stock of the Day</h3>
            </div>
            <p className="text-sm font-semibold mb-2">{stockOfTheDay.headline}</p>
            <p className="text-xs opacity-90 mb-4">{stockOfTheDay.analysis}</p>
            <Button 
                variant="secondary" 
                size="sm" 
                className="w-full"
                onClick={() => router.push(`/trade/${encodeURIComponent(stockOfTheDay.ticker)}`)}
            >
                View {stockOfTheDay.ticker}
            </Button>
          </CardContent>
        </Card>
      )}
      
      {isSearchMode ? (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={`Search to add... e.g. ${market === 'IN' ? 'RELIANCE.NS' : 'AAPL'}`}
              className="pl-10"
              value={searchQuery}
              onChange={handleSearchQueryChange}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsSearchMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isSearching && <Loader2 className="animate-spin my-4 mx-auto" />}
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map(stock => (
              <Card key={stock.ticker} className="p-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{stock.ticker}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{stock.name}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => addStockToWatchlist(stock.ticker)}>
                    <PlusCircle className="h-5 w-5 text-primary" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {watchlists.length > 0 && (
             <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex items-center space-x-1 p-1 bg-muted rounded-md">
                    <TabsList className="p-0 bg-transparent">
                    {watchlists.map((wl) => (
                        <TabsTrigger key={wl.id} value={wl.id} onDoubleClick={() => handleStartEditing(wl)}>
                          {editingWatchlistId === wl.id ? (
                               <Input
                                  value={editingWatchlistName}
                                  onChange={(e) => setEditingWatchlistName(e.target.value)}
                                  onBlur={handleSaveWatchlistName}
                                  onKeyDown={handleEditingKeyDown}
                                  autoFocus
                                  className="h-7 text-sm"
                               />
                          ) : (
                            wl.name
                          )}
                        </TabsTrigger>
                    ))}
                    </TabsList>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <PlusCircle className="h-5 w-5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Create New Watchlist</AlertDialogTitle>
                            <AlertDialogDescription>
                                Enter a name for your new watchlist.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input 
                                placeholder="e.g., Tech Stocks"
                                value={newWatchlistName}
                                onChange={(e) => setNewWatchlistName(e.target.value)}
                            />
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCreateWatchlist}>Create</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          {watchlists.map((wl) => (
            <TabsContent key={wl.id} value={wl.id} className="mt-4">
              <div className="relative my-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search or add..."
                  className="pl-10"
                  onFocus={() => {
                    setIsSearchMode(true);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                />
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {isLoading && filteredStocks.length === 0 ? renderStockSkeleton() : filteredStocks.map((stock) => (
                        <TableRow key={stock.ticker} >
                           <TableCell className="p-3" onClick={() => handleStockClick(stock)}>
                               <div className="flex items-center justify-between">
                                 <div className="flex-1 pr-4">
                                     <p className="font-bold text-sm">{stock.ticker}</p>
                                     <p className="text-xs text-muted-foreground truncate w-40 sm:w-auto">{stock.name}</p>
                                     <p className="text-xs text-primary/80 mt-1 italic">{getStockStatusMessage(stock.changePercent)}</p>
                                 </div>
                                 <div className={cn("text-right font-medium", stock.change >= 0 ? "text-positive" : "text-destructive")}>
                                     <p className="text-base">{currencySymbol}{stock.price.toFixed(2)}</p>
                                     <p className="text-xs">{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)</p>
                                 </div>
                               </div>
                           </TableCell>
                           <TableCell className="p-1 w-10">
                               <Button variant="ghost" size="icon" onClick={() => removeStockFromWatchlist(stock.ticker)}>
                                 <Trash2 className="h-4 w-4 text-destructive/70" />
                               </Button>
                           </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {!isSearchMode && activeWatchlist && activeWatchlist.stocks.length > 0 && (
        <div className="mt-6">
          <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
              <DialogTrigger asChild>
                  <Button className="w-full" disabled={isLoading && Object.keys(stocks).length === 0}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Get AI Stock Analysis
                  </Button>
              </DialogTrigger>
              <AIAnalysisDialog
                stocks={filteredStocks}
                onClose={() => setIsAnalysisDialogOpen(false)}
              />
          </Dialog>
        </div>
      )}

      {!isSearchMode && (
          <section className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Newspaper className="h-5 w-5" /> Related News</h2>
                {news.length > 6 && (
                    <Dialog open={isSeeMoreNewsOpen} onOpenChange={setIsSeeMoreNewsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="link">See More</Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>All News</DialogTitle>
                                <DialogDescription>Showing all articles fetched today.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[60vh] pr-4">
                               <div className="space-y-4">
                                {news.map(article => (
                                    <a href={article.url} target="_blank" rel="noopener noreferrer" key={article.id} className="block">
                                        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                                            <div className="flex gap-4">
                                                <img data-ai-hint="stock market business" src={article.image} alt={article.headline || "News article image"} className="w-24 h-24 object-cover" />
                                                <CardContent className="p-2 flex flex-col justify-center">
                                                    <h3 className="font-semibold leading-tight text-sm mb-1">{article.headline}</h3>
                                                    <p className="text-xs text-muted-foreground">{article.source} &bull; {article.time}</p>
                                                </CardContent>
                                            </div>
                                        </Card>
                                    </a>
                                ))}
                               </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {news.slice(0, 6).map(article => (
                    <a href={article.url} target="_blank" rel="noopener noreferrer" key={article.id}>
                        <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                            <img data-ai-hint="stock market business" src={article.image} alt={article.headline || "News article image"} className="w-full h-32 object-cover bg-muted" />
                            <CardContent className="p-4">
                                <h3 className="font-semibold leading-tight mb-2 text-sm">{article.headline}</h3>
                                <p className="text-xs text-muted-foreground">{article.source} &bull; {article.time}</p>
                            </CardContent>
                        </Card>
                    </a>
                ))}
            </div>
          </section>
      )}
       <StockActionSheet 
        stock={currentStockForSheet} 
        isOpen={isActionSheetOpen} 
        onOpenChange={setIsActionSheetOpen}
        onTrade={handleTradeAction}
        tradeButtonVariant="long-short"
      />
    </div>
  );
}
