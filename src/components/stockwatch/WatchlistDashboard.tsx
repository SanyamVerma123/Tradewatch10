"use client";

import { useState, useMemo } from "react";
import type { Stock, Watchlist, NewsArticle } from "@/lib/types";
import type { SuggestPriceAlertsOutput } from "@/ai/flows/suggest-price-alerts";

import { getPriceAlertSuggestions } from "@/app/actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { ArrowUp, ArrowDown, Search, Sparkles, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WatchlistDashboardProps {
  initialStocks: Stock[];
  initialWatchlists: Watchlist[];
  initialNews: NewsArticle[];
}

export function WatchlistDashboard({
  initialStocks,
  initialWatchlists,
  initialNews,
}: WatchlistDashboardProps) {
  const [activeTab, setActiveTab] = useState(initialWatchlists[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestPriceAlertsOutput>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const { toast } = useToast();

  const activeWatchlist = useMemo(() => {
    return initialWatchlists.find((w) => w.id === activeTab);
  }, [activeTab, initialWatchlists]);

  const filteredStocks = useMemo(() => {
    const stocksInWatchlist =
      activeWatchlist?.stocks.map((ticker) =>
        initialStocks.find((s) => s.ticker === ticker)
      ).filter(Boolean) as Stock[] || [];

    if (!searchTerm) {
      return stocksInWatchlist;
    }

    return stocksInWatchlist.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeWatchlist, initialStocks, searchTerm]);

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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlists</h1>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${initialWatchlists.length}, 1fr)` }}>
          {initialWatchlists.map((wl) => (
            <TabsTrigger key={wl.id} value={wl.id}>
              {wl.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {initialWatchlists.map((wl) => (
          <TabsContent key={wl.id} value={wl.id}>
            <div className="relative my-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search in this watchlist..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow key={stock.ticker}>
                        <TableCell>
                          <div className="font-bold">{stock.ticker}</div>
                          <div className="text-sm text-muted-foreground">{stock.name}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">${stock.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className={cn(
                              "flex items-center justify-end font-semibold",
                              stock.change >= 0 ? "text-positive" : "text-destructive"
                            )}>
                            {stock.change >= 0 ? <ArrowUp className="h-4 w-4 mr-1"/> : <ArrowDown className="h-4 w-4 mr-1"/>}
                            {stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
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

      <div className="mt-6">
        <Button onClick={handleSuggestAlerts} disabled={isLoadingSuggestions} className="w-full">
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
                  <span className="font-semibold text-primary text-lg">${suggestion.suggestedAlertPrice.toFixed(2)}</span>
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
            {initialNews.map(article => (
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
    </div>
  );
}
