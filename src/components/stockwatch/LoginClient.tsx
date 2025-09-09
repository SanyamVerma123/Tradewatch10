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
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface LoginClientProps {
    onToggleView: () => void;
}

export function LoginClient({ onToggleView }: LoginClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.email === email && user.password === password) {
                localStorage.setItem('isLoggedIn', 'true');
                toast({
                    title: "Login Successful",
                    description: `Welcome back, ${user.name}!`,
                });
                router.push("/watchlist");
            } else {
                 toast({
                    variant: "destructive",
                    title: "Invalid Credentials",
                    description: "Please check your email and password.",
                });
            }
        } else {
            toast({
                variant: "destructive",
                title: "No User Found",
                description: "Please sign up to create an account.",
            });
        }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "An error occurred",
            description: "Could not process your login.",
        });
    }
  };

  const handleForgotPassword = () => {
    if (email) {
      toast({
        title: "Password Reset",
        description: `If an account exists for ${email}, a password reset link has been sent.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
      });
    }
  };

  return (
      <Card className="w-full border-0 shadow-none sm:border sm:shadow-lg">
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
              <Input id="email" type="email" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
               <div className="flex items-center">
                  <Button variant="link" type="button" onClick={handleForgotPassword} className="p-0 h-auto text-xs text-muted-foreground">Forgot password?</Button>
               </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              Sign in
            </Button>
             <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto font-semibold">Sign up</Button>
            </p>
          </CardFooter>
        </form>
      </Card>
  );
}
