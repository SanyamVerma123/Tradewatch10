
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
import { ArrowLeft, Plus, Minus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio } from "@/lib/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";

interface FundsData {
  balance: number;
  canAddMore: boolean;
  lastProfitCheck: number;
}

export function FundsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [funds, setFunds] = useState<FundsData | null>(null);
  const [pnl, setPnl] = useState<number>(0);
  const [totalInvested, setTotalInvested] = useState<number>(0);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currencySymbol, currency } = useMarket();

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);

      const fundsKey = `funds_${sbUser.id}`;
      const storedFunds = localStorage.getItem(fundsKey);
      if (storedFunds) {
        setFunds(JSON.parse(storedFunds));
      } else {
        const initialFunds = { balance: currency === 'INR' ? 500000 : 5000, canAddMore: true, lastProfitCheck: 0 };
        setFunds(initialFunds);
        localStorage.setItem(fundsKey, JSON.stringify(initialFunds));
      }

      const portfolioKey = `portfolioData_${sbUser.id}`;
      const updateDataFromPortfolio = () => {
        const portfolioData: Portfolio | null = JSON.parse(localStorage.getItem(portfolioKey) || "null");
        if (portfolioData) {
            setTotalInvested(portfolioData.investedValue || 0);
            setCurrentValue(portfolioData.currentValue || 0);
            setPnl(portfolioData.totalPnl || 0);
        }
      }
      
      updateDataFromPortfolio();
      
      const handleStorageChange = (event: StorageEvent) => {
        if(event.key === portfolioKey){
            updateDataFromPortfolio();
        }
      };

      window.addEventListener('storage', handleStorageChange);
      
      setIsLoading(false);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    };

    fetchUserAndData();
  }, [router, currency]);

  useEffect(() => {
    const checkAndUnlockFunds = () => {
      const profitTarget = currency === 'INR' ? 10000 : 100;
      const bonusAmount = currency === 'INR' ? 500000 : 5000;
      if (user && funds && pnl - funds.lastProfitCheck >= profitTarget && funds.canAddMore) {
          const newFunds = {
              ...funds,
              balance: funds.balance + bonusAmount,
              canAddMore: false, // One time bonus
              lastProfitCheck: pnl
          };
          setFunds(newFunds);
          localStorage.setItem(`funds_${user.id}`, JSON.stringify(newFunds));
          toast({
              title: "Congratulations!",
              description: `You've earned a ${currencySymbol}${profitTarget} profit! You can now add an additional ${currencySymbol}${bonusAmount} to your funds.`,
          });
      }
    }
    
    if (funds) { // Only run if funds have been loaded
        checkAndUnlockFunds();
    }
  }, [pnl, funds, user, toast, currency, currencySymbol]);


  const handleAddFunds = () => {
    if(!funds) return;
    const profitTarget = currency === 'INR' ? 10000 : 100;
    
    if(funds.canAddMore) {
        toast({
            title: "Profit Target Not Met",
            description: `You need to make a profit of ${currencySymbol}${profitTarget} to add more funds. Current profit since last check: ${currencySymbol}${(pnl - (funds?.lastProfitCheck || 0)).toFixed(2)}`,
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

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  const openingBalance = currency === 'INR' ? 500000 : 5000;

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
            {currencySymbol}{funds?.balance.toLocaleString("en-IN", {
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
          <CardTitle>Profit &amp; Loss</CardTitle>
          <CardDescription>
            Your realized and unrealized profit and loss.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
           <div className="flex justify-between font-semibold text-base">
            <span>Overall P&amp;L</span>
            <span className={cn(pnl >= 0 ? 'text-positive' : 'text-destructive')}>
                {pnl >= 0 ? '+' : ''}{currencySymbol}{pnl.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Investment</span>
            <span>{currencySymbol}{totalInvested.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Value</span>
            <span>{currencySymbol}{currentValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
            <span>{currencySymbol}{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payin/Payout</span>
            <span className={cn(pnl >= 0 ? 'text-positive' : 'text-destructive')}>
                {pnl >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(pnl).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Used Margin</span>
            <span>{currencySymbol}0.00</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Available Cash</span>
             <span>
                {currencySymbol}{funds?.balance.toLocaleString("en-IN", {
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
