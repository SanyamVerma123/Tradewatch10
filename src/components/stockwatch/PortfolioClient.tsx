"use client";

import { useState, useEffect } from "react";
import type { Portfolio, Holding } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { portfolio as initialPortfolioData } from "@/lib/portfolio";

export function PortfolioClient() {
  const [activeTab, setActiveTab] = useState("Holdings");
  const [searchTerm, setSearchTerm] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolioData);

  useEffect(() => {
    const storedPortfolio = localStorage.getItem('portfolioData');
    if (storedPortfolio) {
      setPortfolio(JSON.parse(storedPortfolio));
    } else {
      localStorage.setItem('portfolioData', JSON.stringify(initialPortfolioData));
    }
  }, []);

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
                            <div className="text-lg font-semibold">{portfolio.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Current</div>
                            <div className="text-lg font-semibold">{portfolio.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
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
            {filteredHoldings.map((holding) => (
              <Card key={holding.id}>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    <span>{holding.quantity} Qty.</span>
                    <span className="mx-1">&bull;</span>
                    <span>Avg. {holding.avgPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                      <p className="font-bold">{holding.ticker}</p>
                      <div className={cn("text-right font-semibold", holding.dayChange >= 0 ? "text-positive" : "text-destructive")}>
                          <p>{holding.pnl.toFixed(2)}</p>
                          <p className="text-xs">{holding.dayChangePercent.toFixed(2)}%</p>
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

          <div className="mt-6 text-center">
              <Button variant="link" className="text-primary">
                  View Complete Portfolio
              </Button>
          </div>
          
        </TabsContent>
        <TabsContent value="Positions">
          <div className="text-center py-10">
            <p className="text-muted-foreground">You have no positions for the day.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
