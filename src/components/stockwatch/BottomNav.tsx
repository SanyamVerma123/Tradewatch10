
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, PieChart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  { href: "/watchlist", label: "Watchlist", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/profile", label: "Account", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      setIsLoading(false);

      if (!loggedIn && pathname !== '/') {
        router.replace('/');
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
        if (!loggedIn && pathname !== '/') {
            router.replace('/');
        }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };

  }, [pathname, router]);

  if (isLoading || !isLoggedIn || pathname === '/') {
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
