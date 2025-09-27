
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Minus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";
import { Separator } from "@/components/ui/separator";


interface RealizedPnlData {
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
    transactions: {
        ticker: string;
        pnl: number;
        date: string;
    }[];
}

export function FundsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [fundsBalance, setFundsBalance] = useState<number | null>(null);
  const [realizedPnlData, setRealizedPnlData] = useState<RealizedPnlData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currencySymbol, market, currency } = useMarket();

  useEffect(() => {
    const fetchUserAndData = async () => {
      setIsLoading(true);
      const { data: { user: sbUser }, error } = await supabase.auth.getUser();
      if (error || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);

      // Fetch Funds
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds')
        .select('balance')
        .eq('user_id', sbUser.id)
        .eq('market', market)
        .single();
      
      if (fundsData) {
        setFundsBalance(fundsData.balance);
      } else {
         const getInitialBalance = () => {
            switch (currency) {
                case 'INR': return 500000;
                case 'USD': return 5000;
                case 'GBP': return 4000;
                case 'EUR': return 4500;
                case 'JPY': return 750000;
                case 'HKD': return 40000;
                case 'CAD': return 6500;
                default: return 5000;
            }
          };
          setFundsBalance(getInitialBalance());
      }
      
      // Fetch Orders to calculate realized P&L
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('ticker, realized_pnl, executed_at')
        .eq('user_id', sbUser.id)
        .eq('status', 'Executed')
        .not('realized_pnl', 'is', null)
        .order('executed_at', { ascending: false });

      if (ordersData) {
        let totalProfit = 0;
        let totalLoss = 0;
        const transactions = ordersData.map((order: any) => {
            if(order.realized_pnl > 0) {
                totalProfit += order.realized_pnl;
            } else {
                totalLoss += order.realized_pnl;
            }
            return {
                ticker: order.ticker,
                pnl: order.realized_pnl,
                date: new Date(order.executed_at).toLocaleDateString(),
            };
        });

        setRealizedPnlData({
            totalProfit,
            totalLoss,
            netPnl: totalProfit + totalLoss,
            transactions,
        });
      }

      setIsLoading(false);
    };

    fetchUserAndData();
  }, [router, currency, market]);
  
  const handleAddFunds = () => {
    toast({
        title: "Feature Not Available",
        description: "Adding funds is not implemented in this demo.",
    });
  };

  const handleWithdraw = () => {
    toast({
        title: "Withdrawal Pending",
        description: "Your withdrawal request is being processed."
    })
  };

  if (isLoading || fundsBalance === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 pb-24">
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
            {currencySymbol}{fundsBalance.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
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
          <CardTitle>Realized Profit &amp; Loss</CardTitle>
          <CardDescription>
            Your cumulative profit and loss from all closed trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
           <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                    <div className="text-sm font-medium text-positive">Total Profit</div>
                    <div className="text-lg font-bold text-positive">
                        {currencySymbol}{(realizedPnlData?.totalProfit || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                </div>
                 <div>
                    <div className="text-sm font-medium text-destructive">Total Loss</div>
                    <div className="text-lg font-bold text-destructive">
                        {currencySymbol}{(realizedPnlData?.totalLoss || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                </div>
           </div>
           
           <Separator />
           
           <div>
             <h4 className="font-semibold mb-2 text-center text-base">Transactions</h4>
             <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {realizedPnlData && realizedPnlData.transactions.length > 0 ? (
                    realizedPnlData.transactions.map((tx, index) => (
                        <div key={index} className="flex justify-between items-center text-xs p-2 bg-muted/50 rounded-md">
                            <div>
                                <p className="font-semibold text-sm">{tx.ticker}</p>
                                <p className="text-muted-foreground">{tx.date}</p>
                            </div>
                            <p className={cn("font-semibold text-sm", tx.pnl >= 0 ? "text-positive" : "text-destructive")}>
                                {tx.pnl >= 0 ? '+' : ''}{currencySymbol}{tx.pnl.toFixed(2)}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground text-xs py-4">No closed trades yet.</p>
                )}
             </div>
           </div>
        </CardContent>
        {realizedPnlData && (
            <CardFooter className="p-3 bg-card-foreground/5 mt-4">
                 <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-base">Net Realized P&L</span>
                    <span className={cn("font-bold text-lg", realizedPnlData.netPnl >= 0 ? 'text-positive' : 'text-destructive')}>
                        {realizedPnlData.netPnl >= 0 ? '+' : ''}{currencySymbol}{realizedPnlData.netPnl.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                </div>
            </CardFooter>
        )}
      </Card>

    </div>
  );
}
