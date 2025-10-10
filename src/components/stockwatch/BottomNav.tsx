
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, PieChart, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { executeInAppOrders } from "@/app/actions";

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const executionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let sessionChecked = false;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sbUser = session?.user || null;
      setUser(sbUser);
      setIsLoading(false);
      sessionChecked = true;

      if (!sbUser && pathname !== '/') {
        router.replace('/');
      }
    };

    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const sbUser = session?.user || null;
        setUser(sbUser);

        if (_event === 'SIGNED_OUT' && pathname !== '/') {
            router.replace('/');
        } 
        else if (_event === 'SIGNED_IN' && pathname === '/') {
            router.replace('/watchlist');
        }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };

  }, [pathname, router]);

  // In-app order execution heartbeat
  useEffect(() => {
    const startExecutionEngine = () => {
      if (user && !executionIntervalRef.current) {
        console.log("Starting in-app order execution engine...");
        // Immediately run once, then set interval
        executeInAppOrders(); 
        executionIntervalRef.current = setInterval(executeInAppOrders, 5000); // Check every 5 seconds
      }
    };

    const stopExecutionEngine = () => {
      if (executionIntervalRef.current) {
        console.log("Stopping in-app order execution engine.");
        clearInterval(executionIntervalRef.current);
        executionIntervalRef.current = null;
      }
    };

    if (user) {
      startExecutionEngine();
    } else {
      stopExecutionEngine();
    }

    // Cleanup on component unmount
    return () => stopExecutionEngine();
  }, [user]);


  const isLoggedIn = !!user;
  const hideOnPages = ['/', '/community'];

  if (hideOnPages.includes(pathname) || isLoading || !isLoggedIn) {
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

    