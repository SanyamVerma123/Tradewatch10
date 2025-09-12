
"use client";

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
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase/client";
import { watchlists as initialWatchlistsData } from "@/lib/data";

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleClearData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Specifically remove app-related data for the logged-in user
        const fundsKey = `funds_${user.id}`;
        const watchlistsKey = `watchlists_${user.id}`;
        const ordersKey = `orders_${user.id}`;
        const portfolioKey = `portfolioData_${user.id}`;

        localStorage.removeItem(fundsKey);
        localStorage.removeItem(watchlistsKey);
        localStorage.removeItem(ordersKey);
        localStorage.removeItem(portfolioKey);
        
        // Re-initialize data to default state
        const initialFunds = { balance: 200000.00, canAddMore: true, lastProfitCheck: 0 };
        localStorage.setItem(fundsKey, JSON.stringify(initialFunds));
        localStorage.setItem(watchlistsKey, JSON.stringify(initialWatchlistsData));
        localStorage.setItem(ordersKey, '[]');
        localStorage.setItem(portfolioKey, '{"holdings":[],"positions":[]}');
      }

      toast({
        title: "App Data Cleared",
        description: "Your local watchlists, orders, and portfolio have been reset.",
      });

      // Redirect to a main page to see the fresh state
      router.push('/watchlist');
      
    } catch (e) {
      console.error("Error clearing app data:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not clear app data.",
      });
    }
  };

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
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage how you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="push-notifications" className="flex flex-col space-y-1">
                <span>Push Notifications</span>
                <span className="font-normal leading-snug text-muted-foreground">
                    Receive alerts on your device.
                </span>
            </Label>
            <Switch id="push-notifications" defaultChecked />
          </div>
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
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose your preferred interface theme.
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
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Clear your local application data (watchlists, portfolio, etc.) from this device. You will remain logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear App Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all portfolios, orders, and watchlists from this device and reset them to default. Your account will not be deleted and you will remain logged in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData}>
                    Yes, clear data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
