
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/types";
import { watchlists as initialWatchlistsData } from "@/lib/data";

interface SignupClientProps {
  onToggleView: () => void;
}

export function SignupClient({ onToggleView }: SignupClientProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied!",
        description: "User ID copied to clipboard.",
    });
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();

    // Generate a random user ID
    const userId = `OP${Math.floor(100000 + Math.random() * 900000)}`;
    
    const newUser: User = {
        id: userId,
        name,
        email,
        password, // In a real app, this should be hashed
        usedReferralCode: false,
    };

    const initialFunds = {
      balance: 200000.00,
      canAddMore: true,
      lastProfitCheck: 0,
    };

    try {
        // Store user in a global list for referral lookup
        const allUsersText = localStorage.getItem('allUsers');
        const allUsers = allUsersText ? JSON.parse(allUsersText) : {};

        // Check if email already exists
        const emailExists = Object.values(allUsers).some((u: any) => u.email === email);
        if (emailExists) {
            toast({
                variant: "destructive",
                title: "Email already in use",
                description: "Please use a different email address or sign in.",
            });
            return;
        }

        allUsers[userId] = newUser;
        localStorage.setItem('allUsers', JSON.stringify(allUsers));
        
        // Set up initial data for the new user
        localStorage.setItem(`funds_${userId}`, JSON.stringify(initialFunds));
        localStorage.setItem(`watchlists_${userId}`, JSON.stringify(initialWatchlistsData));
        localStorage.setItem(`orders_${userId}`, '[]');
        localStorage.setItem(`portfolioData_${userId}`, '{"holdings":[],"positions":[]}');
        
        toast({
            title: "Account Created!",
            description: `Welcome, ${name}! Your User ID is ${userId}. Please sign in.`,
            action: (
              <button onClick={() => copyToClipboard(userId)} className="ml-4 inline-flex items-center justify-center rounded-md border text-sm font-medium h-8 px-3">
                <Copy className="h-4 w-4 mr-2" /> Copy ID
              </button>
            ),
            duration: 10000,
        });
        onToggleView(); // Switch back to login view
    } catch (error) {
         toast({
            variant: "destructive",
            title: "An error occurred",
            description: "Could not create your account.",
        });
    }
  };

  return (
    <Card className="w-full border-0 shadow-none sm:border sm:shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>
          Get started with StockWatch today.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" type="text" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            Sign up
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto font-semibold">Sign in</Button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
