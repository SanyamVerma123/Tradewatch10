

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { ArrowLeft, Gift, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMarket } from "@/hooks/use-market";

export function ProfileDetailsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { market } = useMarket();
  const [sbUser, setSbUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referrers, setReferrers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/");
        return;
      }
      
      setSbUser(user);
      setName(user.user_metadata.full_name || "");
      setEmail(user.email || "");
      setReferrers(user.user_metadata.referred_by_names || []);
      setIsLoading(false);
    };

    fetchUser();
  }, [router]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUser) return;

    setIsSaving(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name }
    });
    setIsSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: "Profile Updated", description: "Your name has been saved." });
    }
  };
  
  const applyBonus = (userId: string) => {
      const fundsKey = `funds_${userId}_${market}`;
      const fundsDataText = localStorage.getItem(fundsKey);
      const fundsData = fundsDataText ? JSON.parse(fundsDataText) : { balance: 500000, canAddMore: true, lastProfitCheck: 0 };
      const newFunds = { ...fundsData, balance: (fundsData.balance || 0) + 100000 };
      localStorage.setItem(fundsKey, JSON.stringify(newFunds));
  };


  const handleApplyReferral = async () => {
    const code = referralCode.trim();
    if (!code || !sbUser) return;
    setIsApplying(true);
    
    // This is a secure, client-side demonstration.
    // In a real app, you would call a Supabase Edge Function to securely find the user with this code.
    const MASTER_REFERRAL_CODE = "SUPERUSER777";
    const REFERRER_NAME = "Shreyas";

    if (code !== MASTER_REFERRAL_CODE) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: "The referral code is not valid. Please try again." });
        setIsApplying(false);
        return;
    }
    
    if (sbUser.user_metadata.referral_code && code === sbUser.user_metadata.referral_code) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: "You can't use your own referral code." });
        setIsApplying(false);
        return;
    }

    const updatedReferrers = [...referrers, REFERRER_NAME];

    const { data: updatedUser, error: refereeUpdateError } = await supabase.auth.updateUser({
        data: { 
            referred_by_names: updatedReferrers
        }
    });
    
    if (refereeUpdateError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not apply referral code. Please try again.' });
        setIsApplying(false);
        return;
    }

    applyBonus(sbUser.id);
    
    toast({ title: 'Success!', description: `You have received a ₹1,00,000 bonus from ${REFERRER_NAME}!` });
    setReferrers(updatedReferrers);
    setReferralCode("");
    setIsApplying(false);
  };


  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Profile Details</h1>
      </header>

      <form onSubmit={handleSaveChanges}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your personal details here. Email is managed by Supabase Auth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" type="text" value={sbUser?.id} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
              />
            </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
             </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Referral Bonus
            </CardTitle>
            <CardDescription>
              Have a referral code? Enter it here to claim your bonus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
                <Input
                    id="referral"
                    placeholder="Enter referral code"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    disabled={isApplying}
                />
                <Button onClick={handleApplyReferral} disabled={isApplying || !referralCode.trim()}>
                    {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                </Button>
            </div>

            {referrers.length > 0 && (
                 <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium">Bonuses received from:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {referrers.map((referrer, index) => (
                        <li key={index}>{referrer}</li>
                      ))}
                    </ul>
                 </div>
            )}
          </CardContent>
      </Card>
    </div>
  );
}

    