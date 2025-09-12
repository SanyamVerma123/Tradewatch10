
"use client";

import { useState, useEffect } from 'react';
import type { User as AppUser } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Share2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function InviteClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [sbUser, setSbUser] = useState<User | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/");
        return;
      }
      setSbUser(user);
      setReferralCode(user.user_metadata.referral_code || null);
      setIsLoading(false);
    };

    fetchUser();
  }, [router]);

  const generateReferralCode = async () => {
    if (!sbUser) return;
    setIsLoading(true);

    const code = `${(sbUser.user_metadata.full_name || "USER").substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    
    const { data, error } = await supabase.auth.updateUser({
      data: { referral_code: code }
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setReferralCode(code);
      toast({ title: "Code Generated!", description: "Your unique referral code is ready to be shared." });
    }
    setIsLoading(false);
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
    } else if (referralCode) {
        copyToClipboard(`Hey! I'm inviting you to StockWatch. Use my referral code to get a ₹1,00,000 bonus when you sign up: ${referralCode}`);
        toast({description: "Share not supported. Invite message copied to clipboard."});
    }
  }

  if (isLoading && !referralCode) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
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
                    <Button onClick={shareCode} disabled={isLoading}>
                        <Share2 className="mr-2 h-4 w-4" /> Share with Friends
                    </Button>
                </div>
            ) : (
                <Button size="lg" onClick={generateReferralCode} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Your Referral Code'}
                </Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
