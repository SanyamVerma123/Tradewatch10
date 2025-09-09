"use client";

import type { User } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Settings, Info, User as UserIcon, HelpCircle, Gift } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

interface ProfileClientProps {
  user: User;
}

const menuItems = [
    { label: "Funds", icon: () => <span>₹</span>, href: "/funds" },
    { label: "Profile", icon: UserIcon, href: "/profile" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Support", icon: Info, href: "/support" },
    { label: "Invite Friends", icon: Gift, href: "/invite" },
    { label: "User Manual", icon: HelpCircle, href: "/manual" },
];


export function ProfileClient({ user }: ProfileClientProps) {

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 bg-background">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <ChevronDown className="h-6 w-6" />
      </header>

      <p className="text-lg text-muted-foreground mb-4">{user.name}</p>

      <Card className="mb-6">
        <CardContent className="p-4 flex justify-between items-center">
            <div>
                <p className="font-semibold text-lg">{user.id}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Avatar>
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
            </Avatar>
        </CardContent>
      </Card>
      
      <div className="space-y-2">
        {menuItems.map((item) => (
            <Link href={item.href} key={item.label}>
                <Card>
                    <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <item.icon className="h-5 w-5 text-muted-foreground" />
                            <p>{item.label}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>

    </div>
  );
}
