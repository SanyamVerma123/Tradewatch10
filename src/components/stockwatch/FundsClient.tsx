"use client";

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

export function FundsClient() {
  const router = useRouter();
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
          <p className="text-4xl font-bold">₹82,326.12</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Funds
            </Button>
            <Button variant="outline">
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
                <span>₹82,326.12</span>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
