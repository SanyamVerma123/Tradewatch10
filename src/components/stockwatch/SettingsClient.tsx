
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
import { PushNotificationManager } from "./PushNotificationManager";

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleClearData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Clear all local storage for this user
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`funds_${user.id}`) || 
              key.startsWith(`watchlists_${user.id}`) ||
              key.startsWith(`portfolioData_${user.id}`) ||
              key.startsWith(`newsCache_${user.id}`)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.removeItem('market');

        // Clear all supabase data for this user
        await supabase.from('orders').delete().eq('user_id', user.id);
        await supabase.from('watchlists').delete().eq('user_id', user.id);
        await supabase.from('funds').delete().eq('user_id', user.id);

      }
      
      // Sign the user out
      await supabase.auth.signOut();

      toast({
        title: "Data Cleared & Logged Out",
        description: "Your local and cloud application data has been cleared. Please log in again.",
      });

      // Redirect to the auth page
      router.push('/');
      
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
            Clear all your local application data (watchlists, portfolio, etc.) for all markets from this device and from the cloud. You will be logged out.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear App Data & Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your portfolios, orders, and watchlists from this device and the cloud, and then log you out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData}>
                    Yes, clear data and logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
