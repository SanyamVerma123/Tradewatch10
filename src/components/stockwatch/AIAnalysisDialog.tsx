
"use client";

import { useState, useMemo } from "react";
import type { Stock } from "@/lib/types";
import type { GetStockAnalysisOutput } from "@/ai/flows/stock-analysis";
import { getStockAnalysisAction } from "@/app/actions";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AIAnalysisDialogProps {
  stocks: Stock[];
  onClose: () => void;
}

type AnalysisResult = NonNullable<Awaited<ReturnType<typeof getStockAnalysisAction>>>;

export function AIAnalysisDialog({ stocks, onClose }: AIAnalysisDialogProps) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleCheckboxChange = (ticker: string, checked: boolean) => {
    setSelectedTickers((prev) =>
      checked ? [...prev, ticker] : prev.filter((t) => t !== ticker)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTickers(checked ? stocks.map(s => s.ticker) : []);
  };

  const handleSubmit = async () => {
    if (selectedTickers.length === 0) {
      toast({
        variant: "destructive",
        title: "No stocks selected",
        description: "Please select at least one stock to analyze.",
      });
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    const stocksToAnalyze = stocks
      .filter((s) => selectedTickers.includes(s.ticker))
      .map((s) => ({ ticker: s.ticker, currentPrice: s.price }));
      
    try {
      const result = await getStockAnalysisAction({ stocks: stocksToAnalyze });
      if (result) {
        setAnalysisResult(result);
      } else {
        toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: "The AI could not generate an analysis. Please try again.",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: "Failed to get AI analysis.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const allSelected = selectedTickers.length === stocks.length;
  const anySelected = selectedTickers.length > 0;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            AI-Powered Stock Analysis
        </DialogTitle>
        <DialogDescription>
          Select the stocks you want to analyze. The AI will provide insights, news summaries, and price alert suggestions.
        </DialogDescription>
      </DialogHeader>

      {analysisResult ? (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Analysis Results</h3>
            <Accordion type="single" collapsible className="w-full" defaultValue={analysisResult[0]?.ticker}>
             {analysisResult.map((result) => (
                <AccordionItem key={result.ticker} value={result.ticker}>
                    <AccordionTrigger className="font-bold text-base">{result.ticker}</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-1">Analysis</h4>
                            <p className="text-sm text-muted-foreground">{result.analysis}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-1">News Summary</h4>
                            <p className="text-sm text-muted-foreground">{result.newsSummary}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-1">Suggested Price Alert</h4>
                            <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                <span className="text-primary font-bold text-lg">₹{result.priceAlert.suggestedAlertPrice.toFixed(2)}</span>
                                <p className="text-sm text-muted-foreground italic max-w-[70%]">{result.priceAlert.reason}</p>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b pb-2">
                <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-semibold">
                    Select All
                </Label>
            </div>
            <ScrollArea className="h-64">
                <div className="space-y-2 pr-4">
                {stocks.map((stock) => (
                    <div key={stock.ticker} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
                        <Checkbox
                            id={stock.ticker}
                            checked={selectedTickers.includes(stock.ticker)}
                            onCheckedChange={(checked) => handleCheckboxChange(stock.ticker, !!checked)}
                        />
                        <Label htmlFor={stock.ticker} className="w-full flex justify-between cursor-pointer">
                            <div className="font-semibold">{stock.ticker}</div>
                            <div className="text-muted-foreground text-sm">₹{stock.price.toFixed(2)}</div>
                        </Label>
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>
      )}


      <DialogFooter className="mt-4">
        {analysisResult ? (
            <Button onClick={onClose}>Close</Button>
        ) : (
            <>
                <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isLoading || !anySelected}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    `Analyze ${selectedTickers.length} Stock${selectedTickers.length === 1 ? '' : 's'}`
                )}
                </Button>
            </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
