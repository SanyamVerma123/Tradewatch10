
"use client";

import { useState, useEffect, useRef } from "react";
import type { Stock } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PriceEntry {
  price: number;
  id: number;
}

const MAX_HISTORY = 8;

export function MarketDepthHistory({ stock }: { stock: Stock | null }) {
  const [bids, setBids] = useState<PriceEntry[]>([]);
  const [asks, setAsks] = useState<PriceEntry[]>([]);
  const lastBidRef = useRef<number | null>(null);
  const lastAskRef = useRef<number | null>(null);

  useEffect(() => {
    if (stock) {
      if (stock.bid && stock.bid !== lastBidRef.current) {
        setBids((prev) =>
          [{ price: stock.bid!, id: Date.now() }, ...prev].slice(0, MAX_HISTORY)
        );
        lastBidRef.current = stock.bid;
      }

      if (stock.ask && stock.ask !== lastAskRef.current) {
        setAsks((prev) =>
          [{ price: stock.ask!, id: Date.now() }, ...prev].slice(0, MAX_HISTORY)
        );
        lastAskRef.current = stock.ask;
      }
    }
  }, [stock]);

  if (!stock) return null;

  const renderRow = (bid: PriceEntry | undefined, ask: PriceEntry | undefined, index: number) => {
    const isNewest = index === 0;
    const opacityClass = `opacity-${100 - (index * 10)}`;

    return (
        <div 
            key={`depth-${bid?.id || ask?.id || index}`} 
            className={cn(
                "grid grid-cols-2 text-center text-sm py-1 items-center transition-all duration-300 ease-in-out",
                isNewest ? "font-semibold" : "opacity-70",
                index > 4 && "opacity-60", 
                index > 6 && "opacity-40"
            )}
            style={{ transform: `translateY(${index * 100}%)` }}
        >
            <div className={cn("text-blue-500", !bid && "opacity-0")}>
                {bid ? bid.price.toFixed(2) : "0.00"}
            </div>
            <div className={cn("text-red-500", !ask && "opacity-0")}>
                {ask ? ask.price.toFixed(2) : "0.00"}
            </div>
        </div>
    );
  }
  
   const totalBidDisplay = (Math.floor(Math.random() * 90000) + 10000).toLocaleString('en-IN');
   const totalAskDisplay = (Math.floor(Math.random() * 90000) + 10000).toLocaleString('en-IN');


  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Market Price History</h3>
      <div className="rounded-md border p-2">
        <div className="grid grid-cols-2 text-center font-semibold text-xs text-muted-foreground border-b pb-2 mb-1">
          <div>BIDS</div>
          <div>ASKS</div>
        </div>
        <div className="relative h-[224px] overflow-hidden">
            {Array.from({ length: MAX_HISTORY }).map((_, i) => {
              const bid = bids[i];
              const ask = asks[i];
              return (
                 <div key={`depth-${bid?.id || ask?.id || i}`} className="absolute w-full transition-transform duration-500 ease-out" style={{transform: `translateY(${i * 100}%)`}}>
                    <div className={cn("grid grid-cols-2 text-center text-sm py-1 items-center", i > 4 && "opacity-60", i > 6 && "opacity-40")}>
                      <div className={cn("text-blue-500", !bid && "opacity-0")}>
                        {bid ? bid.price.toFixed(2) : "-"}
                      </div>
                      <div className={cn("text-red-500", !ask && "opacity-0")}>
                        {ask ? ask.price.toFixed(2) : "-"}
                      </div>
                    </div>
                </div>
              )
            })}
        </div>
         <div className="grid grid-cols-2 text-center font-semibold text-xs text-muted-foreground border-t pt-2 mt-1">
            <div>Total Bid: <span className="text-foreground">{totalBidDisplay}</span></div>
            <div>Total Ask: <span className="text-foreground">{totalAskDisplay}</span></div>
        </div>
      </div>
    </div>
  );
}
