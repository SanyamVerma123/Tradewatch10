
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FundsData {
  balance: number;
  canAddMore: boolean;
  lastProfitCheck: number;
}

export function FundsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [funds, setFunds] = useState<FundsData | null>(null);
  const [pnl, setPnl] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const storedFunds = localStorage.getItem("funds");
    if (storedFunds) {
      setFunds(JSON.parse(storedFunds));
    } else {
       // Initialize if not present
      const initialFunds = { balance: 200000, canAddMore: true, lastProfitCheck: 0 };
      setFunds(initialFunds);
      localStorage.setItem("funds", JSON.stringify(initialFunds));
    }

    const portfolioData: Portfolio | null = JSON.parse(localStorage.getItem("portfolioData") || "null");
    
    if (portfolioData) {
        const holdingsInvested = portfolioData.holdings.reduce((acc, h) => acc + h.investedValue, 0);
        const holdingsCurrentValue = portfolioData.holdings.reduce((acc, h) => acc + (h.ltp * h.quantity), 0);
        const positionsPnl = portfolioData.positions.reduce((acc, p) => acc + p.pnl, 0);

        const totalInvestedVal = holdingsInvested;
        const totalCurrentVal = holdingsCurrentValue + positionsPnl;

        setTotalInvested(totalInvestedVal);
        setCurrentValue(totalCurrentVal);
        setPnl(totalCurrentVal - totalInvestedVal);
    } else {
        const investedValue = 0; // Starting with empty portfolio
        const currentValue = 0;
        const totalPnl = currentValue - investedValue;
        setCurrentValue(currentValue);
        setTotalInvested(investedValue);
        setPnl(totalPnl);
    }

  }, []);

  const checkAndUnlockFunds = () => {
    if (funds && pnl - funds.lastProfitCheck >= 10000 && funds.canAddMore) {
        const newFunds = {
            ...funds,
            balance: funds.balance + 200000,
            canAddMore: false, // One time bonus
            lastProfitCheck: pnl
        };
        setFunds(newFunds);
        localStorage.setItem("funds", JSON.stringify(newFunds));
        toast({
            title: "Congratulations!",
            description: "You've earned a ₹10,000 profit! You can now add an additional ₹2,00,000 to your funds.",
        });
    }
  }

  useEffect(() => {
    if (funds) { // Only run if funds have been loaded
        checkAndUnlockFunds();
    }
  }, [pnl, funds]);


  const handleAddFunds = () => {
    if(!funds) return;

    if(funds.canAddMore) {
        toast({
            title: "Profit Target Not Met",
            description: `You need to make a profit of ₹10,000 to add more funds. Current profit since last check: ₹${(pnl - (funds?.lastProfitCheck || 0)).toFixed(2)}`,
            variant: "destructive"
        });
    } else {
         toast({
            title: "Funds Already Added",
            description: "You have already received your one-time fund bonus.",
        });
    }
  };

  const handleWithdraw = () => {
    toast({
        title: "Withdrawal Pending",
        description: "Your withdrawal request is being processed."
    })
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Funds</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Available Balance</CardTitle>
          <CardDescription>Total funds you can use for trading.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">
            ₹{funds?.balance.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) || "0.00"}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Button onClick={handleAddFunds}>
              <Plus className="mr-2 h-4 w-4" /> Add Funds
            </Button>
            <Button variant="outline" onClick={handleWithdraw}>
              <Minus className="mr-2 h-4 w-4" /> Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profit & Loss</CardTitle>
          <CardDescription>
            Your realized and unrealized profit and loss.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
           <div className="flex justify-between font-semibold text-base">
            <span>Overall P&L</span>
            <span className={cn(pnl >= 0 ? 'text-positive' : 'text-destructive')}>
                {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Investment</span>
            <span>₹{totalInvested.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Value</span>
            <span>₹{currentValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Margin Details</CardTitle>
          <CardDescription>
            Breakdown of your available and used margins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opening Balance</span>
            <span>₹2,00,000.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payin/Payout</span>
            <span className={cn(pnl >= 0 ? 'text-positive' : 'text-destructive')}>
                {pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Used Margin</span>
            <span>₹0.00</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Available Cash</span>
             <span>
                ₹{funds?.balance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                }) || "0.00"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
