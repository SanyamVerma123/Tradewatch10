
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

export function ProfileDetailsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [sbUser, setSbUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferral, setAppliedReferral] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);

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
      setAppliedReferral(!!user.user_metadata.used_referral_code);
      if (user.user_metadata.used_referral_code) {
        setReferrerName(user.user_metadata.referred_by_name || "a friend");
      }
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
      const fundsKey = `funds_${userId}`;
      // Initialize if funds don't exist for some reason
      const fundsDataText = localStorage.getItem(fundsKey);
      const fundsData = fundsDataText ? JSON.parse(fundsDataText) : { balance: 200000, canAddMore: true, lastProfitCheck: 0 };
      const newFunds = { ...fundsData, balance: (fundsData.balance || 0) + 100000 };
      localStorage.setItem(fundsKey, JSON.stringify(newFunds));
  };


  const handleApplyReferral = async () => {
    if (!referralCode.trim() || !sbUser) return;
    setIsApplying(true);
    
    if (referralCode.trim() === sbUser.user_metadata.referral_code) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: "You can't use your own referral code." });
        setIsApplying(false);
        return;
    }

    // This is for demonstration. It uses the current user's name as the referrer's name.
    // A real implementation would require a secure backend function to look up the referrer.
    const referrerDisplayName = sbUser.user_metadata.full_name || "a friend";

    // 1. Update current user (referee) metadata to mark as used
    const { data: updatedUser, error: refereeUpdateError } = await supabase.auth.updateUser({
        data: { 
            used_referral_code: true,
            referred_by_name: referrerDisplayName, // Store the name for display
        }
    });
    
    if (refereeUpdateError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not apply referral code. Please try again.' });
        setIsApplying(false);
        return;
    }

    // 2. Apply bonus to the current user.
    applyBonus(sbUser.id);
    
    // In a real app, you would also need to find the referrer by their code (via a backend function)
    // and apply their bonus.
    
    toast({ title: 'Success!', description: `You have received a ₹1,00,000 bonus from ${referrerDisplayName}!` });
    setAppliedReferral(true);
    setReferrerName(referrerDisplayName);
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
          <CardContent>
            {appliedReferral ? (
                 <div className="text-green-600 font-semibold space-y-1">
                    <p>Referral bonus has been applied to your account!</p>
                    {referrerName && <p className="text-sm font-medium text-muted-foreground">Bonus from: {referrerName}</p>}
                 </div>
            ) : (
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
            )}
          </CardContent>
      </Card>
    </div>
  );
}
