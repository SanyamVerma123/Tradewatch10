"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/types";
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
import { ArrowLeft, Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function ProfileDetailsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferral, setAppliedReferral] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser: User = JSON.parse(storedUser);
      setUser(parsedUser);
      setName(parsedUser.name);
      setEmail(parsedUser.email);
      if (parsedUser.usedReferralCode) {
        setAppliedReferral(true);
      }
    } else {
      router.replace("/");
    }
  }, [router]);

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      const updatedUser = { ...user, name, email };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    }
  };

  const handleApplyReferral = () => {
    if (!referralCode.trim() || !user) return;

    const allUsersText = localStorage.getItem('allUsers');
    if (!allUsersText) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: 'Referral code not found.' });
        return;
    }

    const allUsers: { [key: string]: User } = JSON.parse(allUsersText);
    const referrer = Object.values(allUsers).find(u => u.referralCode === referralCode.trim());

    if (referrer && referrer.id !== user.id) {
        // Update referee's data
        const refereeFundsData = JSON.parse(localStorage.getItem('funds') || '{}');
        const newRefereeFunds = { ...refereeFundsData, balance: (refereeFundsData.balance || 0) + 100000 };
        localStorage.setItem('funds', JSON.stringify(newRefereeFunds));
        
        const updatedRefereeUser = { ...user, usedReferralCode: true };
        localStorage.setItem('user', JSON.stringify(updatedRefereeUser));
        
        // Update referrer's data
        const referrerFundsData = JSON.parse(localStorage.getItem(`funds_${referrer.id}`) || JSON.stringify({ balance: 200000 }));
        const newReferrerFunds = { ...referrerFundsData, balance: (referrerFundsData.balance || 0) + 100000 };
        localStorage.setItem(`funds_${referrer.id}`, JSON.stringify(newReferrerFunds));
        
        toast({ title: 'Success!', description: 'You and your friend have both received ₹1,00,000!' });
        setAppliedReferral(true);
    } else {
        toast({ variant: 'destructive', title: 'Invalid Code', description: 'Referral code is not valid or belongs to you.' });
    }
  };


  if (!user) {
    return null; // Or a loading spinner
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
              Update your personal details here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" type="text" value={user.id} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" className="w-full sm:w-auto">Save Changes</Button>
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
                 <p className="text-green-600 font-semibold">Referral bonus has been applied to your account!</p>
            ) : (
                <div className="flex gap-2">
                    <Input
                        id="referral"
                        placeholder="Enter referral code"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                    />
                    <Button onClick={handleApplyReferral}>Apply</Button>
                </div>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
