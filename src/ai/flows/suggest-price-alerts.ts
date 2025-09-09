'use server';

/**
 * @fileOverview A price alert suggestion AI agent.
 *
 * - suggestPriceAlerts - A function that suggests price alerts for stocks in a watchlist.
 * - SuggestPriceAlertsInput - The input type for the suggestPriceAlerts function.
 * - SuggestPriceAlertsOutput - The return type for the suggestPriceAlerts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestPriceAlertsInputSchema = z.object({
  watchlist: z.array(
    z.object({
      ticker: z.string().describe('The ticker symbol of the stock.'),
      currentPrice: z.number().describe('The current market price of the stock.'),
    })
  ).describe('The user\'s stock watchlist.'),
});
export type SuggestPriceAlertsInput = z.infer<typeof SuggestPriceAlertsInputSchema>;

const SuggestPriceAlertsOutputSchema = z.array(
  z.object({
    ticker: z.string().describe('The ticker symbol of the stock.'),
    suggestedAlertPrice: z.number().describe('The suggested price to set an alert at.'),
    reason: z.string().describe('The reasoning behind the suggested price alert.'),
  })
);
export type SuggestPriceAlertsOutput = z.infer<typeof SuggestPriceAlertsOutputSchema>;

export async function suggestPriceAlerts(input: SuggestPriceAlertsInput): Promise<SuggestPriceAlertsOutput> {
  return suggestPriceAlertsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPriceAlertsPrompt',
  input: {schema: SuggestPriceAlertsInputSchema},
  output: {schema: SuggestPriceAlertsOutputSchema},
  prompt: `You are an AI assistant that suggests price alerts for stocks in a user's watchlist.

  Given the following watchlist of stocks and their current prices, suggest a price alert for each stock.
  Explain the reasoning behind each suggested price alert. Consider recent price movements, volatility, and potential support/resistance levels.

  Watchlist:
  {{#each watchlist}}
  - Ticker: {{ticker}}, Current Price: {{currentPrice}}
  {{/each}}

  Output should be a JSON array of objects, each containing the ticker, suggestedAlertPrice, and reason.
  Make sure the suggestedAlertPrice is within a reasonable range of the current price.
  Make sure the reason is well explained.
  `, // Removed Handlebars helper
});

const suggestPriceAlertsFlow = ai.defineFlow(
  {
    name: 'suggestPriceAlertsFlow',
    inputSchema: SuggestPriceAlertsInputSchema,
    outputSchema: SuggestPriceAlertsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
