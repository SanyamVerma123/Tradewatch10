"use client";

import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function InviteClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser: User = JSON.parse(storedUser);
      setUser(parsedUser);
      if(parsedUser.referralCode) {
        setReferralCode(parsedUser.referralCode);
      }
    } else {
      router.replace("/");
    }
  }, [router]);

  const generateReferralCode = () => {
    if (!user) return;
    const code = `${user.name.substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const updatedUser = { ...user, referralCode: code };

    // Update current user in local storage
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setReferralCode(code);

    // Update user in the global list for lookup
    const allUsersText = localStorage.getItem('allUsers');
    const allUsers = allUsersText ? JSON.parse(allUsersText) : {};
    allUsers[user.id] = updatedUser;
    localStorage.setItem('allUsers', JSON.stringify(allUsers));
    
    toast({
      title: "Code Generated!",
      description: "Your unique referral code is ready to be shared.",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        description: "Referral code copied to clipboard.",
    });
  }

  const shareCode = () => {
    if (navigator.share && referralCode) {
      navigator.share({
        title: 'Join me on StockWatch!',
        text: `Hey! I'm inviting you to StockWatch. Use my referral code to get a ₹1,00,000 bonus when you sign up: ${referralCode}`,
        url: window.location.origin,
      }).catch((error) => console.log('Error sharing', error));
    } else {
        copyToClipboard(`Hey! I'm inviting you to StockWatch. Use my referral code to get a ₹1,00,000 bonus when you sign up: ${referralCode}`);
        toast({description: "Share not supported. Invite message copied to clipboard."});
    }
  }


  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Invite Friends</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Refer & Earn ₹1,00,000</CardTitle>
          <CardDescription>
            Invite your friends to StockWatch. When they sign up and enter your referral code, you both get a bonus of ₹1,00,000 in your funds!
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
            {referralCode ? (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-muted-foreground">Your unique referral code is:</p>
                    <div className="bg-muted p-3 rounded-lg flex items-center gap-4">
                        <p className="text-2xl font-bold tracking-widest text-primary">{referralCode}</p>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(referralCode)}>
                            <Copy className="h-5 w-5" />
                        </Button>
                    </div>
                    <Button onClick={shareCode}>
                        <Share2 className="mr-2 h-4 w-4" /> Share with Friends
                    </Button>
                </div>
            ) : (
                <Button size="lg" onClick={generateReferralCode}>Generate Your Referral Code</Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
