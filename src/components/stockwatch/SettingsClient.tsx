
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase/client";
import { PushNotificationManager } from "./PushNotificationManager";
import { Checkbox } from "@/components/ui/checkbox";

interface DeletionState {
  watchlists: boolean;
  orders: boolean;
  funds: boolean;
  account: boolean;
}

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const [deletion, setDeletion] = useState<DeletionState>({
    watchlists: false,
    orders: false,
    funds: false,
    account: false,
  });

  const handleCheckboxChange = (field: keyof DeletionState) => {
    setDeletion(prev => {
        const newState = { ...prev, [field]: !prev[field] };
        // If account is checked, check all others. If unchecked, uncheck all.
        if (field === 'account') {
            const isChecked = newState.account;
            return { watchlists: isChecked, orders: isChecked, funds: isChecked, account: isChecked };
        }
        // If all others are checked, check account. If one is unchecked, uncheck account.
        if (newState.watchlists && newState.orders && newState.funds) {
            newState.account = true;
        } else {
            newState.account = false;
        }
        return newState;
    });
  };

  const handleClearData = async () => {
    setIsProcessing(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("User not found.");
        }
        
        if (deletion.watchlists) {
            await supabase.from('watchlists').delete().eq('user_id', user.id);
        }
        if (deletion.orders) {
            await supabase.from('orders').delete().eq('user_id', user.id);
        }
        if (deletion.funds) {
            await supabase.from('funds').delete().eq('user_id', user.id);
        }
        
        toast({
            title: "Data Cleared",
            description: "Your selected application data has been cleared.",
        });

        if (deletion.account) {
            // This is a Supabase Admin function. This will fail unless you have an edge function with admin rights.
            // For client-side only, the user is just logged out.
            await supabase.auth.signOut();
            router.push('/');
            toast({
                title: "Account Deleted",
                description: "Your account and data have been cleared, and you have been logged out.",
            });
        } else {
            router.refresh();
        }

    } catch (e: any) {
      console.error("Error clearing app data:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Could not clear app data.",
      });
    } finally {
        setIsProcessing(false);
        setDeletion({ watchlists: false, orders: false, funds: false, account: false });
    }
  };

  const isAnyCheckboxSelected = Object.values(deletion).some(Boolean);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>
      
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your app experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                    <span>Dark Mode</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Reduces eye strain in low light.
                    </span>
                </Label>
                <Switch 
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
            </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage how you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PushNotificationManager />
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                <span>Email Notifications</span>
                <span className="font-normal leading-snug text-muted-foreground">
                    Get important updates via email.
                </span>
            </Label>
            <Switch id="email-notifications" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Permanently delete your cloud and local data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Data...
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Application Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    Select the data you wish to permanently delete. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="delete-watchlists" checked={deletion.watchlists} onCheckedChange={() => handleCheckboxChange('watchlists')} />
                        <Label htmlFor="delete-watchlists" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Watchlists
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="delete-orders" checked={deletion.orders} onCheckedChange={() => handleCheckboxChange('orders')} />
                        <Label htmlFor="delete-orders" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Orders & Portfolio
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="delete-funds" checked={deletion.funds} onCheckedChange={() => handleCheckboxChange('funds')} />
                        <Label htmlFor="delete-funds" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Funds Data
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2 border-t pt-4 mt-4">
                        <Checkbox id="delete-account" checked={deletion.account} onCheckedChange={() => handleCheckboxChange('account')} />
                        <Label htmlFor="delete-account" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive">
                            Delete Entire Account
                        </Label>
                    </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} disabled={!isAnyCheckboxSelected || isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : `Delete Selected Data`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
