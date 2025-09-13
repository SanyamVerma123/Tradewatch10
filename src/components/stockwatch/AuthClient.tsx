
"use client";

import { useState } from "react";
import { LoginClient } from "./LoginClient";
import { SignupClient } from "./SignupClient";

const Logo = () => (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]"
    >
      <path
        d="M12 36L24 24L36 36"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 20L24 12L32 20"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
);


export function AuthClient() {
  const [isLoginView, setIsLoginView] = useState(true);

  const toggleView = () => setIsLoginView(!isLoginView);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 antialiased">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] dark:bg-background dark:bg-[linear-gradient(to_right,theme(colors.border)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.border)_1px,transparent_1px)]">
            <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_50%_200px,theme(colors.primary/0.25),transparent)]"></div>
        </div>

       <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-3 mb-8">
            <Logo />
            <h1 className="text-4xl font-bold tracking-tight text-foreground">StockImage</h1>
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
