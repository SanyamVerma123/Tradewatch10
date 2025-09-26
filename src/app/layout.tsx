
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/stockwatch/ThemeProvider";
import BottomNav from "@/components/stockwatch/BottomNav";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MarketProvider } from "@/hooks/use-market";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StockWatch",
  description: "A modern stock trading application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Next.js</title>
      </head>
      <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          <MarketProvider>
            <div className="relative flex min-h-screen w-full flex-col">
              <main className="flex-1 pb-16">{children}</main>
              <BottomNav />
            </div>
            <Toaster />
          </MarketProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
