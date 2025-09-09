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
import { Eye, EyeOff, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignupClientProps {
  onToggleView: () => void;
}

export function SignupClient({ onToggleView }: SignupClientProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();

    // Generate a random user ID
    const userId = `OP${Math.floor(100000 + Math.random() * 900000)}`;
    
    const newUser = {
        id: userId,
        name,
        email,
        password // In a real app, this should be hashed
    };

    try {
        localStorage.setItem('user', JSON.stringify(newUser));
        toast({
            title: "Account Created!",
            description: `Welcome, ${name}! Your User ID is ${userId}.`,
        });
        onToggleView(); // Switch back to login view
    } catch (error) {
         toast({
            variant: "destructive",
            title: "An error occurred",
            description: "Could not create your account.",
        });
    }
  };

  return (
    <Card className="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Building className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>
          Get started with StockWatch today.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" type="text" placeholder="e.g. John Doe" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="e.g. john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            Sign up
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" type="button" onClick={onToggleView} className="p-0 h-auto">Sign in</Button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
