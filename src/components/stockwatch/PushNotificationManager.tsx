
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { messaging } from '@/lib/firebase/client';
import { getToken } from 'firebase/messaging';
import { BellRing, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export function PushNotificationManager() {
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setIsSubscribed(true);
        }
      }
      setIsLoading(false);
    }
    // Delay check slightly to ensure messaging object is initialized
    setTimeout(checkPermission, 500);
  }, []);

  const handleSubscribe = async () => {
    if (!messaging) {
        toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Push notifications are not supported on this browser, or the VAPID key is missing.' });
        return;
    }
    
    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        
        // Get the token
        const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY });
        
        if (fcmToken) {
          console.log('FCM Token:', fcmToken);
          const { data: { user } } = await supabase.auth.getUser();
          
          if(user) {
            // In a real app, you would send this token to your backend to associate it with the user.
            // For example: await sendTokenToServer(user.id, fcmToken);
            console.log(`Token for user ${user.id} is ${fcmToken}`);
            toast({ title: 'Notifications Enabled!', description: 'You will now receive push alerts.' });
          }
          
          setIsSubscribed(true);
        } else {
            toast({ variant: 'destructive', title: 'Could not get token', description: 'Please try again.' });
        }
      } else {
        toast({ variant: 'destructive', title: 'Notifications Denied', description: 'You have blocked notifications. You can change this in your browser settings.' });
      }
    } catch (error) {
      console.error('Error getting permission or token', error);
      toast({ variant: 'destructive', title: 'Subscription Error', description: 'An error occurred while enabling notifications. Check your console for details.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed || !('serviceWorker' in navigator) || !window.Notification) {
      toast({
        variant: "destructive",
        title: "Not Ready",
        description: "Please enable notifications first and ensure you're on a compatible browser.",
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("StockWatch Test", {
        body: "This is a test notification from StockWatch!",
        icon: "/icon-192x192.png", // Make sure you have an icon here
        badge: "/badge-72x72.png", // and a badge here
        actions: [
          { action: 'view_watchlist', title: 'View Watchlist' },
        ]
      });
    } catch (err) {
      console.error('Error showing test notification:', err);
      toast({
        variant: "destructive",
        title: "Could not show notification",
        description: "There was an error displaying the test notification."
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-1">
                <span className="font-medium">Push Notifications</span>
                <span className="text-sm font-normal leading-snug text-muted-foreground">
                    {isSubscribed ? 'You are subscribed to push notifications.' : 'Receive alerts on your device.'}
                </span>
            </div>
            {!isSubscribed && (
                <Button onClick={handleSubscribe} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                    Enable
                </Button>
            )}
        </div>
        {isSubscribed && (
            <Button variant="outline" onClick={handleTestNotification}>
                <Send className="mr-2 h-4 w-4" />
                Send Test Notification
            </Button>
        )}
    </div>
  );
}
