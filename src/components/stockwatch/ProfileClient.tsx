
"use client";

import { useEffect, useState } from "react";
import type { User as AppUser } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Settings, Info, User as UserIcon, HelpCircle, Gift, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const menuItems = [
    { label: "Funds", icon: () => <span className="font-bold text-lg">₹</span>, href: "/funds" },
    { label: "Profile Details", icon: UserIcon, href: "/profile-details" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Support", icon: Info, href: "/support" },
    { label: "Invite Friends", icon: Gift, href: "/invite" },
    { label: "User Manual", icon: HelpCircle, href: "/manual" },
];

export function ProfileClient() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.replace('/');
        return;
      }
      
      const currentUser = session.user;
      setUser({
        id: currentUser.id,
        name: currentUser.user_metadata.full_name || 'User',
        email: currentUser.email || '',
        referralCode: currentUser.user_metadata.referral_code,
        usedReferralCode: currentUser.user_metadata.used_referral_code,
        referredByNames: currentUser.user_metadata.referred_by_names,
      });
    };
    
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) {
    return null; // Or a loading spinner
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 bg-background">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <ChevronDown className="h-6 w-6" />
      </header>

      <p className="text-lg text-muted-foreground mb-4">{user.name}</p>

      <Card className="mb-6">
        <CardContent className="p-4 flex justify-between items-center">
            <div>
                <p className="font-semibold text-lg">{user.id}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Avatar>
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
            </Avatar>
        </CardContent>
      </Card>
      
      <div className="space-y-2">
        {menuItems.map((item) => (
            <Link href={item.href} key={item.label}>
                <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <item.icon className="h-5 w-5 text-muted-foreground" />
                            <p>{item.label}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>

       <Card className="mt-4 hover:bg-destructive/10 transition-colors" onClick={handleLogout}>
          <CardContent className="p-4 flex justify-between items-center cursor-pointer">
              <div className="flex items-center gap-4">
                  <LogOut className="h-5 w-5 text-destructive" />
                  <p className="font-semibold text-destructive">Logout</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
      </Card>
      
      <footer className="mt-12 text-center text-xs text-muted-foreground space-y-2">
        <div className="flex items-center justify-center gap-2">
            <span>Made in India, for India</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 15"><path fill="#f93" d="M0 0h21v5H0z"/><path fill="#fff" d="M0 5h21v5H0z"/><path fill="#128807" d="M0 10h21v5H0z"/><g transform="translate(10.5 7.5)"><circle r="2" fill="#008"/><path stroke="#008" strokeWidth=".2" d="m0 2l-.12-.3a.32.32 0 1 1 .24 0M.97.16l-.42-.2a.32.32 0 1 1 .48.33M.8.8l-.5-.04a.32.32 0 1 1 .16.48M.16.97l-.2-.42a.32.32 0 1 1 .33.48M-.6.8l-.04-.5a.32.32 0 1 1 .48.16M-1 .16l-.42.2a.32.32 0 1 1 .33-.48M-.8-.6.04-.5a.32.32 0 1 1-.48-.16M-.16-.97l.2-.42a.32.32 0 1 1-.33.48"/></g></svg>
        </div>
        <p>© Powered by Sanyam</p>
      </footer>

    </div>
  );
}
