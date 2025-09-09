"use client";

import { useState } from "react";
import { LoginClient } from "./LoginClient";
import { SignupClient } from "./SignupClient";
import { Building } from "lucide-react";

export function AuthClient() {
  const [isLoginView, setIsLoginView] = useState(true);

  const toggleView = () => setIsLoginView(!isLoginView);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-4 mb-8">
            <Building className="h-10 w-10 text-primary"/>
            <h1 className="text-3xl font-bold tracking-tight">StockWatch</h1>
        </div>
        {isLoginView ? (
            <LoginClient onToggleView={toggleView} />
        ) : (
            <SignupClient onToggleView={toggleView} />
        )}
       </div>
    </div>
  );
}
