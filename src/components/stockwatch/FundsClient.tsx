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

  useEffect(() => {
    const storedFunds = localStorage.getItem("funds");
    if (storedFunds) {
      setFunds(JSON.parse(storedFunds));
    }

    const portfolioData = localStorage.getItem("portfolioData");
    if (portfolioData) {
      const parsedData = JSON.parse(portfolioData);
      setPnl(parsedData.totalPnl);
    } else {
        const investedValue = 60765.32;
        const currentValue = 82326.12;
        const totalPnl = currentValue - investedValue;
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
    checkAndUnlockFunds();
  }, [pnl, funds]);


  const handleAddFunds = () => {
    if(funds?.canAddMore) {
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
          <CardTitle>Margin Details</CardTitle>
          <CardDescription>
            Breakdown of your available and used margins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opening Balance</span>
            <span>₹60,765.32</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payin</span>
            <span>₹21,560.80</span>
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
