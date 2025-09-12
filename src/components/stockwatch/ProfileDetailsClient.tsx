
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

    // This is a simplified client-side check. 
    // In a production app, you would use a serverless function to securely query users.
    // We cannot query the `auth.users` table directly from the client.
    // For this prototype, we'll assume a `profiles` table exists that mirrors user data.
    // This will likely fail if RLS is not configured on a `profiles` table.
    // The logic is illustrative of a real implementation.
    
    // 1. Find the referrer by their referral_code.
    // NOTE: This requires a `profiles` table with `id` and `referral_code` columns, 
    // and Row Level Security (RLS) allowing reads.
    const { data: referrerProfile, error: findError } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .eq('referral_code', referralCode.trim())
      .single();

    if (findError || !referrerProfile) {
      toast({ variant: 'destructive', title: 'Invalid Code', description: 'Referral code not found. Please ensure your `profiles` table is set up correctly with RLS.' });
      setIsApplying(false);
      return;
    }
    
    if (referrerProfile.id === sbUser.id) {
      toast({ variant: 'destructive', title: 'Invalid Code', description: "You can't use your own referral code." });
      setIsApplying(false);
      return;
    }
    
    // 2. Update current user (referee) metadata
    const { data: updatedUser, error: refereeUpdateError } = await supabase.auth.updateUser({
        data: { 
            used_referral_code: true,
            referred_by: referrerProfile.id // Save who referred this user
        }
    });
    
    if (refereeUpdateError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not apply referral code. Please try again.' });
        setIsApplying(false);
        return;
    }

    // 3. Apply bonus to both users locally
    applyBonus(sbUser.id); // Apply to current user
    applyBonus(referrerProfile.id); // Apply to the referrer
    
    toast({ title: 'Success!', description: 'You and your friend have both received a ₹1,00,000 bonus!' });
    setAppliedReferral(true);
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
              Have a referral code? Enter it here to claim your bonus. Note: This requires a `profiles` table in Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appliedReferral ? (
                 <p className="text-green-600 font-semibold">Referral bonus has been applied to your account!</p>
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
