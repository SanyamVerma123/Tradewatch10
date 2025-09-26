
"use client";

import { useEffect, useState } from "react";
import type { User as AppUser } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Settings, Info, User as UserIcon, HelpCircle, Gift, LogOut, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useMarket, marketDetails, Market } from "@/hooks/use-market";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [user, setUser] = useState<AppUser | null>(null);
  const { market, setMarket } = useMarket();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market>(market);

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
  
  const handleMarketSwitchConfirm = async () => {
    setMarket(selectedMarket);
    
    toast({
        title: "Market Switched",
        description: `Market has been changed to ${marketDetails[selectedMarket].name}. Please log in again.`,
    });
    
    await supabase.auth.signOut();
    router.push('/');
  }

  const handleMarketSelect = (newMarket: Market) => {
    if (newMarket !== market) {
        setSelectedMarket(newMarket);
        setIsAlertOpen(true);
    }
  }

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
      
       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Card className="mt-4 hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                                <p className="font-semibold">Switch Market</p>
                            </div>
                            <Button variant="outline" size="sm" className="gap-2">
                                {marketDetails[market].name}
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {Object.entries(marketDetails).map(([key, details]) => (
                        <DropdownMenuItem key={key} onSelect={() => handleMarketSelect(key as Market)}>
                            {details.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Switch to {marketDetails[selectedMarket].name} Market?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will switch your active market and log you out. You will need to sign in again to see the changes. Are you sure?
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleMarketSwitchConfirm}>
                    Yes, Switch & Logout
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
       </AlertDialog>


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
        <p>© Powered by Sanyam Verma</p>
      </footer>

    </div>
  );
}
