
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Stock, Watchlist, NewsArticle } from "@/lib/types";
import type { SuggestPriceAlertsOutput } from "@/ai/flows/suggest-price-alerts";
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

import { getPriceAlertSuggestions, getStockData, searchStocks } from "@/app/actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { ArrowUp, ArrowDown, Search, Sparkles, Settings, Loader2, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { watchlists as initialWatchlistsData, news as initialNewsData } from "@/lib/data";
import { StockActionSheet } from "./StockActionSheet";


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
  const [suggestions, setSuggestions] = useState<SuggestPriceAlertsOutput>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const { toast } = useToast();
  const [stocks, setStocks] = useState<Record<string, Stock>>({});
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);
  const [newWatchlistName, setNewWatchlistName] = useState("");

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ticker: string, name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  
  useEffect(() => {
    const loadedWatchlists = JSON.parse(localStorage.getItem('watchlists') || JSON.stringify(initialWatchlistsData));
    setWatchlists(loadedWatchlists);
    if (loadedWatchlists.length > 0) {
      setActiveTab(loadedWatchlists[0].id);
    }
  }, []);

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

  const handleSuggestAlerts = async () => {
    if (!activeWatchlist) return;

    setIsLoadingSuggestions(true);
    setSuggestions([]);
    
    const watchlistForAI = filteredStocks.map(stock => ({
        ticker: stock.ticker,
        currentPrice: stock.price,
    }));

    try {
        const result = await getPriceAlertSuggestions(watchlistForAI);
        if (result && result.length > 0) {
            setSuggestions(result);
        } else {
            toast({
                title: "AI Suggestions",
                description: "No new suggestions were generated. The market seems stable.",
            });
        }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "An error occurred",
            description: "Failed to get AI suggestions.",
        });
        console.error(error);
    } finally {
        setIsLoadingSuggestions(false);
    }
  };

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
    if (!activeWatchlist) return;

    const updatedWatchlists = watchlists.map(wl => {
      if (wl.id === activeWatchlist.id) {
        if (wl.stocks.includes(ticker)) {
          toast({
            description: `${ticker} is already in this watchlist.`,
          });
          return wl;
        }
        toast({
          title: "Success",
          description: `${ticker} added to ${wl.name}.`,
        });
        return { ...wl, stocks: [...wl.stocks, ticker] };
      }
      return wl;
    });

    setWatchlists(updatedWatchlists);
    localStorage.setItem('watchlists', JSON.stringify(updatedWatchlists));
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
    if (!newWatchlistName.trim()) {
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
    localStorage.setItem('watchlists', JSON.stringify(updatedWatchlists));
    setActiveTab(newWatchlist.id);
    setNewWatchlistName("");
  };

  const handleStockClick = (stock: Stock) => {
    setSelectedStock(stock);
    setIsActionSheetOpen(true);
  }

  const handleTradeAction = (type: 'buy' | 'sell', ticker: string) => {
    router.push(`/trade/${encodeURIComponent(ticker)}?type=${type}`);
    setIsActionSheetOpen(false);
  }

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
                        <TabsTrigger key={wl.id} value={wl.id}>
                        {wl.name}
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
                                 <div className={cn("text-right font-medium", stock.change >= 0 ? "text-green-600" : "text-red-600")}>
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
            <Button onClick={handleSuggestAlerts} disabled={isLoadingSuggestions || (isLoadingStocks && Object.keys(stocks).length === 0)} className="w-full">
              {isLoadingSuggestions ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Get AI Price Alert Suggestions
            </Button>
          </div>

          {isLoadingSuggestions && (
            <Card className="mt-4 animate-in fade-in-50">
                <CardHeader>
                    <CardTitle>Generating Suggestions...</CardTitle>
                    <CardDescription>Our AI is analyzing the market data for your watchlist.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="flex items-center space-x-4">
                              <div className="h-12 w-12 rounded-full bg-muted animate-pulse"></div>
                              <div className="space-y-2 flex-1">
                                  <div className="h-4 bg-muted animate-pulse rounded"></div>
                                  <div className="h-4 bg-muted animate-pulse rounded" style={{width: `${Math.random() * 40 + 50}%`}}></div>
                              </div>
                          </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
          )}

          {suggestions.length > 0 && (
            <Card className="mt-4 animate-in fade-in-50">
              <CardHeader>
                <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary" /> AI Price Alert Suggestions</CardTitle>
                <CardDescription>Based on recent trends and market data.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.ticker} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{suggestion.ticker}</span>
                      <span className="font-semibold text-primary text-lg">₹{suggestion.suggestedAlertPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>
                  </div>
                ))}
                </div>
              </CardContent>
            </Card>
          )}

          <section className="mt-8">
            <h2 className="text-xl font-bold mb-4">Related News</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {initialNewsData.map(article => (
                    <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <Image data-ai-hint="stock news" src={article.image} alt={article.headline} width={400} height={200} className="w-full h-32 object-cover" />
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
        stock={selectedStock} 
        isOpen={isActionSheetOpen} 
        onOpenChange={setIsActionSheetOpen}
        onTrade={handleTradeAction}
        tradeButtonVariant="long-short"
      />
    </div>
  );
}

