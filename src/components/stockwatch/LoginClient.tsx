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
import { Eye, EyeOff, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface LoginClientProps {
    onToggleView: () => void;
}

export function LoginClient({ onToggleView }: LoginClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.id === userId && user.password === password) {
                toast({
                    title: "Login Successful",
                    description: `Welcome back, ${user.name}!`,
                });
                router.push("/watchlist");
            } else {
                 toast({
                    variant: "destructive",
                    title: "Invalid Credentials",
                    description: "Please check your User ID and password.",
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

  return (
      <Card className="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <Building className="h-10 w-10 text-primary"/>
            </div>
          <CardTitle className="text-2xl font-bold">Welcome to StockWatch</CardTitle>
          <CardDescription>
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" type="text" placeholder="e.g. OP0000" required value={userId} onChange={(e) => setUserId(e.target.value)} />
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
                  <Button variant="link" type="button" className="p-0 h-auto text-xs">Forgot password?</Button>
               </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              Sign in
            </Button>
             <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto">Sign up</Button>
            </p>
          </CardFooter>
        </form>
      </Card>
  );
}
