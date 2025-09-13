"use server";

/**
 * @fileOverview An AI support agent for the StockImage app.
 *
 * - getSupportResponse - A function that provides answers to user questions about the app.
 * - GetSupportResponseInput - The input type for the getSupportResponse function (string).
 * - GetSupportResponseOutput - The return type for the getSupportResponse function (string).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export type GetSupportResponseInput = string;
export type GetSupportResponseOutput = string;

export async function getSupportResponse(input: GetSupportResponseInput): Promise<GetSupportResponseOutput> {
  return supportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'supportPrompt',
  input: { schema: z.string() },
  output: { schema: z.string() },
  prompt: `You are a helpful AI assistant for a stock trading application called StockImage.
Your role is to answer user questions about how to use the app. Be friendly, concise, and clear.

The app has the following features:
- Watchlists: Users can create and manage multiple watchlists of stocks.
- Trading: Users can place BUY and SELL orders. Order types include Market, Limit, and Stop-Loss (SL, SL-M).
- Products: Trades can be 'Intraday (MIS)' or 'Longterm (CNC)'. MIS positions are auto-squared off at the end of the day.
- Portfolio: Shows two tabs - 'Positions' for today's trades and 'Holdings' for long-term investments from previous days.
- Funds: Users can see their available cash, total invested value, and overall profit/loss.
- AI Suggestions: The app provides AI-powered suggestions for price alerts.
- Referral Program: Users can generate a referral code. If another user applies it, both get a ₹1,00,000 bonus.
- Dark Mode: Available in the settings.

Based on this context, answer the user's question.

User Question: {{{prompt}}}
`,
});

const supportFlow = ai.defineFlow(
  {
    name: 'supportFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (query) => {
    const { output } = await prompt(query);
    return output!;
  }
);
