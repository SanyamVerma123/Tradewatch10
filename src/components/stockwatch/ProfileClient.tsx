"use client";

import type { User } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Settings, Info, User as UserIcon, HelpCircle, Gift } from "lucide-react";

interface ProfileClientProps {
  user: User;
}

const menuItems = [
    { label: "Funds", icon: () => <span>₹</span> },
    { label: "Profile", icon: UserIcon },
    { label: "Settings", icon: Settings },
    { label: "Support", icon: Info },
    { label: "Invite Friends", icon: Gift },
    { label: "User Manual", icon: HelpCircle },
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
            <Card key={item.label}>
                <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <p>{item.label}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
            </Card>
        ))}
      </div>

    </div>
  );
}
