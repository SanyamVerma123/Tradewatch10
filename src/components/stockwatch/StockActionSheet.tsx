"use client";

import type { Stock } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell, BarChart2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface StockActionSheetProps {
  stock: Stock | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function StockActionSheet({ stock, isOpen, onOpenChange }: StockActionSheetProps) {
    const router = useRouter();

    if (!stock) return null;

    const handleTradeClick = (type: 'buy' | 'sell') => {
        // In a real app, we might pass the type via query params
        // or handle it in the component state after navigation.
        router.push(`/trade/${encodeURIComponent(stock.ticker)}`);
        onOpenChange(false);
    }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-lg">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg">{stock.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-4">
            <span>NSE: <span className="font-semibold text-foreground">₹{stock.price.toFixed(2)}</span></span>
            <span className={cn("font-semibold", stock.change >= 0 ? "text-positive" : "text-destructive")}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
            </span>
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleTradeClick('buy')}>Buy</Button>
                <Button size="lg" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleTradeClick('sell')}>Sell</Button>
            </div>
            <div className="flex justify-center items-center text-primary font-semibold">
                <BarChart2 className="h-4 w-4 mr-2" />
                <span>View chart</span>
            </div>
        </div>
        <Separator />
         <div className="py-4 space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Create alert</span>
                </div>
                <Zap className="h-5 w-5 text-primary" />
            </div>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Create GTT</span>
                </div>
            </div>
        </div>
        <Separator />
        <div className="py-4 text-center text-muted-foreground">
            Market depth
        </div>
      </SheetContent>
    </Sheet>
  );
}
