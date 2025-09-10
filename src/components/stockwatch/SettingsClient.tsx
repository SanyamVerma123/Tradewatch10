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

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleClearData = () => {
    try {
        localStorage.clear(); // Clear all local storage for the domain
        toast({
            title: "Data Cleared",
            description: "All your data has been successfully cleared.",
        });
        router.push('/');
    } catch(e) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not clear app data.",
        })
    }
  }

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
            Clear all your local application data.
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
                    This action cannot be undone. This will permanently delete all your account data, including profile, portfolio, orders, and watchlists from this device.
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
