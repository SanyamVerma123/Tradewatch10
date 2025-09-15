
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
  DialogTrigger,
} from "@/components/ui/dialog";

import { getStockData, searchStocks } from "@/app/actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { Search, Sparkles, Settings, Loader2, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { watchlists as initialWatchlistsData, news as allNewsData } from "@/lib/data";
import { StockActionSheet } from "./StockActionSheet";
import { AIAnalysisDialog } from "./AIAnalysisDialog";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";


const getStockStatusMessage = (changePercent: number): string => {
    if (changePercent > 1.5) return "Strong upward momentum today.";
    if (changePercent > 0.5) return "Showing positive signs.";
    if (changePercent > 0) return "Trading slightly higher.";
    if (changePercent < -1.5) return "Facing significant selling pressure.";
    if (changePercent < -0.5) return "Currently on a downward trend.";
    if (changePercent < 0) return "Seeing a slight dip in price.";
    return "Market appears stable for this stock.";
};


export function WatchlistDashboard() {
  const router = useRouter();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [stocks, setStocks] = useState<Record<string, Stock>>({});
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ticker: string, name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null);
  const [editingWatchlistName, setEditingWatchlistName] = useState("");
  const [news, setNews] = useState<NewsArticle[]>([]);
  
  const shuffleNews = useCallback(() => {
    const shuffled = [...allNewsData].sort(() => 0.5 - Math.random());
    setNews(shuffled.slice(0, 3));
  }, []);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);
      
      const watchlistsKey = `watchlists_${sbUser.id}`;
      const loadedWatchlists = JSON.parse(localStorage.getItem(watchlistsKey) || JSON.stringify(initialWatchlistsData));
      setWatchlists(loadedWatchlists);
      if (loadedWatchlists.length > 0 && !activeTab) {
          setActiveTab(loadedWatchlists[0].id);
      }
    };
    
    fetchUserAndData();
    shuffleNews();
    const newsInterval = setInterval(shuffleNews, 1000 * 60 * 60); // Refresh every hour
    
    return () => clearInterval(newsInterval);
  }, [router, shuffleNews, activeTab]);

  const activeWatchlist = useMemo(() => {
    return watchlists.find((w) => w.id === activeTab);
  }, [activeTab, watchlists]);

  const fetchStockData = useCallback(async (isSilent = false) => {
    if (!activeWatchlist) return;
    if (activeWatchlist.stocks.length === 0) {
        setIsLoadingStocks(false);
        setStocks({});
        return;
    };


    if (!isSilent) setIsLoadingStocks(true);
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch watchlist data.",
      });
    } finally {
      if (!isSilent) setIsLoadingStocks(false);
    }
  }, [activeWatchlist, toast]);

  useEffect(() => {
    if (activeWatchlist) {
      fetchStockData();
      const interval = setInterval(() => fetchStockData(true), 5000); // Refresh every 5s for live price feel
      return () => clearInterval(interval);
    }
  }, [activeWatchlist, fetchStockData]);

  const filteredStocks = useMemo(() => {
    if (!activeWatchlist) return [];
    
    const currentStocks = activeWatchlist.stocks
        .map(ticker => stocks[ticker])
        .filter(Boolean); // Filter out any undefined stocks

    if (!searchTerm) {
      return currentStocks;
    }
    return currentStocks.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stocks, searchTerm, activeWatchlist]);

  const handleSearchQueryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 1) {
      setIsSearching(true);
      const results = await searchStocks(e.target.value);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const addStockToWatchlist = (ticker: string) => {
    if (!activeWatchlist || !user) return;

    if (activeWatchlist.stocks.includes(ticker)) {
        toast({
            description: `${ticker} is already in this watchlist.`,
        });
        return;
    }

    let previousWatchlistName: string | undefined;

    const updatedWatchlists = watchlists.map(wl => {
        // Remove from any other watchlist
        if (wl.stocks.includes(ticker)) {
            previousWatchlistName = wl.name;
            return { ...wl, stocks: wl.stocks.filter(s => s !== ticker) };
        }
        return wl;
    }).map(wl => {
        // Add to the active watchlist
        if (wl.id === activeWatchlist.id) {
            return { ...wl, stocks: [...wl.stocks, ticker] };
        }
        return wl;
    });

    setWatchlists(updatedWatchlists);
    localStorage.setItem(`watchlists_${user.id}`, JSON.stringify(updatedWatchlists));
    
    if (previousWatchlistName) {
        toast({
            title: "Stock Moved",
            description: `${ticker} moved from "${previousWatchlistName}" to "${activeWatchlist.name}".`,
        });
    } else {
        toast({
            title: "Stock Added",
            description: `${ticker} added to "${activeWatchlist.name}".`,
        });
    }
    
    const newActiveWl = updatedWatchlists.find(wl => wl.id === activeWatchlist.id);
    if (newActiveWl) {
        setIsLoadingStocks(true);
        getStockData(newActiveWl.stocks).then(data => {
            const newStockData: Record<string, Stock> = {};
            data.forEach(s => newStockData[s.ticker] = s);
            setStocks(prev => ({...prev, ...newStockData}));
            setIsLoadingStocks(false);
        });
    }

    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
  };

  const handleCreateWatchlist = () => {
    if (!newWatchlistName.trim() || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Watchlist name cannot be empty.",
      });
      return;
    }
    const newWatchlist: Watchlist = {
      id: `watchlist-${Date.now()}`,
      name: newWatchlistName,
      stocks: [],
    };
    const updatedWatchlists = [...watchlists, newWatchlist];
    setWatchlists(updatedWatchlists);
    localStorage.setItem(`watchlists_${user.id}`, JSON.stringify(updatedWatchlists));
    setActiveTab(newWatchlist.id);
    setNewWatchlistName("");
  };

  const handleStockClick = (stock: Stock) => {
    setSelectedStock(stock);
    setIsActionSheetOpen(true);
  }

  const handleTradeAction = (type: 'buy' | 'sell', ticker: string) => {
    const stock = stocks[ticker];
    // Short selling is always MIS
    const isShortSell = type === 'sell';
    const orderData: Partial<Order> = {
        type: type === 'buy' ? 'BUY' : 'SELL',
        ticker: ticker,
        quantity: 1,
        product: isShortSell ? 'MIS' : 'CNC', // Default to CNC for buy, enforce MIS for short
        orderMethod: 'MARKET',
        ltp: stock?.price || 0,
        price: stock?.price?.toFixed(2) || '0',
        isShortSell: isShortSell,
    };
    router.push(`/trade/${encodeURIComponent(ticker)}?order=${encodeURIComponent(JSON.stringify(orderData))}`);
    setIsActionSheetOpen(false);
  }

  const handleStartEditing = (watchlist: Watchlist) => {
    setEditingWatchlistId(watchlist.id);
    setEditingWatchlistName(watchlist.name);
  };

  const handleSaveWatchlistName = () => {
    if (!editingWatchlistId || !editingWatchlistName.trim() || !user) {
        setEditingWatchlistId(null);
        return;
    };

    const updatedWatchlists = watchlists.map(wl => 
        wl.id === editingWatchlistId ? { ...wl, name: editingWatchlistName } : wl
    );
    setWatchlists(updatedWatchlists);
    localStorage.setItem(`watchlists_${user.id}`, JSON.stringify(updatedWatchlists));
    toast({
        title: "Watchlist Renamed",
        description: `Successfully renamed to "${editingWatchlistName}".`
    });
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
        <TableCell colSpan={2}>
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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlists</h1>
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
      </header>
      
      {isSearchMode ? (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search stocks to add (e.g., INFY.NS)"
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {isLoadingStocks && filteredStocks.length === 0 ? renderStockSkeleton() : filteredStocks.map((stock) => (
                        <TableRow key={stock.ticker} onClick={() => handleStockClick(stock)} className="cursor-pointer">
                           <TableCell colSpan={2} className="p-3">
                               <div className="flex items-center justify-between">
                                 <div className="flex-1 pr-4">
                                     <p className="font-bold text-sm">{stock.ticker}</p>
                                     <p className="text-xs text-muted-foreground truncate w-40 sm:w-auto">{stock.name}</p>
                                     <p className="text-xs text-primary/80 mt-1 italic">{getStockStatusMessage(stock.changePercent)}</p>
                                 </div>
                                 <div className={cn("text-right font-medium", stock.change >= 0 ? "text-positive" : "text-destructive")}>
                                     <p className="text-base">₹{stock.price.toFixed(2)}</p>
                                     <p className="text-xs">{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)</p>
                                 </div>
                               </div>
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

      {!isSearchMode && (
        <>
          <div className="mt-6">
            <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="w-full" disabled={isLoadingStocks && Object.keys(stocks).length === 0}>
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

          <section className="mt-8">
            <h2 className="text-xl font-bold mb-4">Related News</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {news.map(article => (
                    <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <Image data-ai-hint="stock market news" src={article.image} alt={article.headline} width={400} height={200} className="w-full h-32 object-cover" />
                        <CardContent className="p-4">
                            <h3 className="font-semibold leading-tight mb-2">{article.headline}</h3>
                            <p className="text-xs text-muted-foreground">{article.source} &bull; {article.time}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
          </section>
        </>
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

    