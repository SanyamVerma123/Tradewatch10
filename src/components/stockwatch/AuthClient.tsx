"use client";

import { useState } from "react";
import { LoginClient } from "./LoginClient";
import { SignupClient } from "./SignupClient";

export function AuthClient() {
  const [isLoginView, setIsLoginView] = useState(true);

  const toggleView = () => setIsLoginView(!isLoginView);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {isLoginView ? (
        <LoginClient onToggleView={toggleView} />
      ) : (
        <SignupClient onToggleView={toggleView} />
      )}
    </div>
  );
}
