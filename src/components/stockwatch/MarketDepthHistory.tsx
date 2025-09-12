
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
  const [totalBid, setTotalBid] = useState(0);
  const [totalAsk, setTotalAsk] = useState(0);

  useEffect(() => {
    if (stock) {
      const now = Date.now();
      if (stock.bid && stock.bid !== lastBidRef.current) {
        setBids((prev) =>
          [{ price: stock.bid!, id: now }, ...prev].slice(0, MAX_HISTORY)
        );
        lastBidRef.current = stock.bid;
        // Simulate a fluctuating total volume for visual effect
        setTotalBid(Math.floor(Math.random() * 5000) + (stock.volume / 1000));
      }

      if (stock.ask && stock.ask !== lastAskRef.current) {
        setAsks((prev) =>
          [{ price: stock.ask!, id: now + 1 }, ...prev].slice(0, MAX_HISTORY)
        );
        lastAskRef.current = stock.ask;
        // Simulate a fluctuating total volume for visual effect
        setTotalAsk(Math.floor(Math.random() * 5000) + (stock.volume / 1000));
      }
    }
  }, [stock]);

  if (!stock) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Market Price History</h3>
      <div className="rounded-md border p-2">
        <div className="grid grid-cols-2 text-center font-semibold text-xs text-muted-foreground border-b pb-2 mb-1">
          <div>BIDS</div>
          <div>ASKS</div>
        </div>
        <div className="relative h-56 overflow-hidden">
            <div className="grid grid-cols-2 text-center text-sm">
                {/* Bids Column */}
                <div className="relative h-full">
                    {bids.map((bid, index) => (
                        <div
                            key={bid.id}
                            className={cn(
                                "absolute w-full py-1 text-blue-500 transition-all duration-500 ease-out",
                                index > 0 && "opacity-70",
                                index > 2 && "opacity-50",
                                index > 5 && "opacity-30"
                            )}
                            style={{ transform: `translateY(${index * 1.75}rem)` }}
                        >
                            {bid.price.toFixed(2)}
                        </div>
                    ))}
                </div>
                {/* Asks Column */}
                <div className="relative h-full">
                     {asks.map((ask, index) => (
                        <div
                            key={ask.id}
                            className={cn(
                                "absolute w-full py-1 text-red-500 transition-all duration-500 ease-out",
                                index > 0 && "opacity-70",
                                index > 2 && "opacity-50",
                                index > 5 && "opacity-30"
                            )}
                            style={{ transform: `translateY(${index * 1.75}rem)` }}
                        >
                            {ask.price.toFixed(2)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
         <div className="grid grid-cols-2 text-center font-semibold text-xs text-muted-foreground border-t pt-2 mt-1">
            <div>Total Bid: <span className="text-foreground">{Math.floor(totalBid).toLocaleString('en-IN')}</span></div>
            <div>Total Ask: <span className="text-foreground">{Math.floor(totalAsk).toLocaleString('en-IN')}</span></div>
        </div>
      </div>
    </div>
  );
}
