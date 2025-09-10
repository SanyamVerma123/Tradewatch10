
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

const manualSections = [
  {
    value: "item-1",
    title: "Using Your Watchlist",
    content: `
      Your watchlist is the heart of the app, allowing you to track stocks you're interested in.
      \n\n- **Adding Stocks**: Tap the search bar on the watchlist screen, find your stock, and tap the plus icon to add it.
      \n- **Creating New Watchlists**: Tap the plus icon next to the watchlist tabs to create a new, custom watchlist.
      \n- **Renaming Watchlists**: Double-tap any watchlist's name to edit it. Press Enter to save.
      \n- **AI Suggestions**: Tap the "Get AI Price Alert Suggestions" button to receive AI-powered price targets for stocks in your current watchlist.
    `,
  },
  {
    value: "item-2",
    title: "How to Place an Order",
    content: `
      Placing an order is simple and fast.
      \n\n1. **Select a Stock**: Tap any stock in your watchlist to open the action sheet.
      \n2. **Choose Action**: Tap 'Buy' or 'Sell'. This will take you to the trade screen.
      \n3. **Enter Details**: Fill in the quantity and price (for limit orders).
      \n4. **Select Product**: Choose 'Intraday (MIS)' for trades you want to close today, or 'Longterm (CNC)' for investments.
      \n5. **Select Order Type**: Choose between Market, Limit, SL, or SL-M.
      \n6. **Swipe to Confirm**: Swipe the button at the bottom of the screen to place your order.
    `,
  },
  {
    value: "item-3",
    title: "Understanding Order Types",
    content: `
      StockWatch supports several order types to give you full control.
      \n\n- **Market Order**: Buys or sells immediately at the current best available price. The price field will be disabled.
      \n- **Limit Order**: Buys or sells at a specific price you set, or better. The order will only execute if the market reaches your limit price.
      \n- **Stop Loss (SL)**: A limit order that is triggered when the stock hits a certain 'trigger price'. It's used to limit your potential losses on a position. It requires both a trigger price and a limit price.
      \n- **Stop Loss-Market (SL-M)**: Similar to an SL order, but it becomes a market order once the trigger price is hit. This ensures your order executes but doesn't guarantee the price.
    `,
  },
  {
    value: "item-4",
    title: "Portfolio: Holdings vs. Positions",
    content: `
      Your portfolio is split into two main views to give you clarity.
      \n\n- **Positions**: This tab shows all your trading activity for the current day. This includes both intraday (MIS) trades and any new longterm (CNC) investments you've made today. All daily profit and loss is calculated here. MIS positions are automatically closed at the end of the day.
      \n\n- **Holdings**: This tab shows your long-term investments. Any 'CNC' stocks you bought on previous days will appear here. This gives you a clear view of your investment portfolio, separate from your daily trades.
    `,
  },
  {
    value: "item-5",
    title: "Managing Your Account",
    content: `
      The 'Account' tab is your hub for managing funds and profile settings.
      \n\n- **Funds**: View your available cash, total investment value, and overall profit/loss. You can also add or withdraw funds here.
      \n- **Profile Details**: Update your name and email address. You can also apply a referral code here to get a bonus.
      \n- **Invite Friends**: Generate your unique referral code to share with friends. When they sign up and use your code, you both get a bonus!
      \n- **Settings**: Toggle dark mode and manage other app preferences.
    `,
  },
];

export function ManualClient() {
  const router = useRouter();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">User Manual</h1>
      </header>

      <Accordion type="single" collapsible className="w-full">
        {manualSections.map((section) => (
          <AccordionItem key={section.value} value={section.value}>
            <AccordionTrigger className="text-lg hover:no-underline">
              {section.title}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground whitespace-pre-line text-base">
              {section.content.trim()}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
