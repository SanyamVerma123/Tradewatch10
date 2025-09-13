
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { supabase } from "@/lib/supabase/client";

interface LoginClientProps {
    onToggleView: () => void;
}

export function LoginClient({ onToggleView }: LoginClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message,
        });
    } else if (data.user) {
        localStorage.setItem(`postLoginFundNotification_${data.user.id}`, "true");
        toast({
            title: "Login Successful",
            description: `Welcome back!`,
        });
        router.push("/watchlist");
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
        toast({ title: "Password Reset", description: `If an account exists, a password reset link has been sent to ${email}.` });
    }
  };

  return (
      <Card className="w-full bg-background/80 backdrop-blur-sm border-border/20 shadow-[0_4px_15px_hsl(var(--primary)/0.1),0_8px_30px_hsl(var(--primary)/0.15),0_0_2px_hsl(var(--primary)/0.2)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
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
               <div className="flex items-center">
                  <Button variant="link" type="button" onClick={handleForgotPassword} className="p-0 h-auto text-xs text-muted-foreground" disabled={isLoading}>Forgot password?</Button>
               </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="animate-spin" />}
              {!isLoading && "Sign in"}
            </Button>
             <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto font-semibold" disabled={isLoading}>Sign up</Button>
            </p>
          </CardFooter>
        </form>
      </Card>
  );
}
