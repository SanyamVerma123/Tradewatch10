
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, PieChart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getNewsFromGNews } from "@/app/actions";
import type { NewsArticle } from "@/lib/types";

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: User },
];

async function showDelayedFundNotification() {
    if (!('serviceWorker' in navigator) || !window.Notification || Notification.permission !== 'granted') {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("Funds Credited!", {
        body: "Your starting fund of ₹5,00,000 has been credited to your account.",
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
      });
    } catch (err) {
      console.error('Error showing fund notification:', err);
    }
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndCacheNews = useCallback(async (userId: string) => {
    const newsCacheKey = `newsCache_${userId}`;
    const cachedNewsData = localStorage.getItem(newsCacheKey);
    let shouldFetch = true;

    if (cachedNewsData) {
        const { timestamp } = JSON.parse(cachedNewsData);
        const lastFetch = new Date(timestamp);
        const now = new Date();
        const oneHour = 60 * 60 * 1000;
        if (now.getTime() - lastFetch.getTime() < oneHour) {
            shouldFetch = false;
        }
    }

    if (shouldFetch) {
        const liveNews = await getNewsFromGNews();
        if (liveNews) {
            const articles: NewsArticle[] = liveNews.map((article: any) => ({
                id: article.url,
                headline: article.title,
                source: article.source.name,
                time: new Date(article.publishedAt).toLocaleString(),
                image: article.image || `https://picsum.photos/seed/${Math.random()}/400/200`,
                url: article.url,
            }));

            const today = new Date().toDateString();
            const newsCache = {
                timestamp: new Date().toISOString(),
                date: today,
                articles: articles,
            };
            localStorage.setItem(newsCacheKey, JSON.stringify(newsCache));
            // Manually trigger a storage event so other tabs get the new data
            window.dispatchEvent(new StorageEvent('storage', {
                key: newsCacheKey,
                newValue: JSON.stringify(newsCache),
            }));
        }
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      setIsLoading(false);

      if (!loggedIn && pathname !== '/') {
        router.replace('/');
        return;
      }
      
      if (loggedIn && session.user) {
        // Fetch news on initial load
        fetchAndCacheNews(session.user.id);
        
        // Check for post-login fund notification
        const notifFlag = `postLoginFundNotification_${session.user.id}`;
        if (localStorage.getItem(notifFlag) === 'true') {
            localStorage.removeItem(notifFlag);
            
            setTimeout(() => {
                const fundsKey = `funds_${session.user!.id}`;
                const fundsData = localStorage.getItem(fundsKey);
                if (!fundsData) {
                    const initialFunds = { balance: 500000, canAddMore: true, lastProfitCheck: 0 };
                    localStorage.setItem(fundsKey, JSON.stringify(initialFunds));
                }
                showDelayedFundNotification();
            }, 60000);
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
        if (_event === 'SIGNED_OUT' && pathname !== '/') {
            router.replace('/');
        } else if (_event === 'SIGNED_IN' && pathname === '/') {
            router.replace('/watchlist');
        }
    });
    
    // Set up hourly news fetch
    const newsInterval = setInterval(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchAndCacheNews(session.user.id);
            }
        });
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(newsInterval);
    };

  }, [pathname, router, fetchAndCacheNews]);

  if (pathname === '/' || isLoading || !isLoggedIn) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
