
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { watchlists as initialWatchlistsData } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";

interface SignupClientProps {
  onToggleView: () => void;
}

export function SignupClient({ onToggleView }: SignupClientProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message,
      });
    } else if (user) {
      // Initialize app-specific data in local storage, namespaced by user ID
      const userId = user.id;
      // Do not initialize funds here. It will be done post-login via notification.
      localStorage.setItem(`watchlists_${userId}`, JSON.stringify(initialWatchlistsData));
      localStorage.setItem(`orders_${userId}`, '[]');
      localStorage.setItem(`portfolioData_${userId}`, '{"holdings":[],"positions":[]}');
      
      toast({
        title: "Account Created!",
        description: "Please check your email to confirm your account and sign in.",
        duration: 10000,
      });
      onToggleView(); // Switch back to login view
    }
    setIsLoading(false);
  };

  return (
    <Card className="w-full bg-background/80 backdrop-blur-sm border-border/20 shadow-[0_4px_15px_hsl(var(--primary)/0.1),0_8px_30px_hsl(var(--primary)/0.15),0_0_2px_hsl(var(--primary)/0.2)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>
          Get started with StockWatch today.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" type="text" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="animate-spin" />}
            {!isLoading && "Sign up"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto font-semibold" disabled={isLoading}>Sign in</Button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
