
'use server';

/**
 * @fileOverview An AI agent that selects and analyzes the "Stock of the Day" based on news.
 *
 * - getStockOfTheDay - A function that returns the AI-selected stock and its analysis.
 * - GetStockOfTheDayOutput - The return type for the getStockOfTheDay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import yahooFinance from 'yahoo-finance2';

const yahooFinanceOptions = {
    validateResult: false
};

// Tool to get general market news
const getMarketNewsTool = ai.defineTool(
    {
        name: 'getMarketNews',
        description: 'Get the latest news articles for the overall market.',
        inputSchema: z.object({ query: z.string().describe('A general query like "stock market" to get broad news.') }),
        outputSchema: z.array(z.object({
            uuid: z.string(),
            title: z.string(),
            link: z.string(),
            publisher: z.string(),
            providerPublishTime: z.number(),
        })),
    },
    async ({ query }) => {
        try {
            const results = await yahooFinance.search(query, { newsCount: 15 }, yahooFinanceOptions);
            return results.news;
        } catch (error) {
            console.error('Error fetching market news:', error);
            return [];
        }
    }
);


const GetStockOfTheDayOutputSchema = z.object({
    ticker: z.string().describe('The ticker symbol of the stock chosen as Stock of the Day.'),
    headline: z.string().describe('A catchy headline for why this stock was chosen.'),
    analysis: z.string().describe('A brief, insightful analysis (2-3 sentences) of why this stock is the Stock of the Day, based on the news.'),
});
export type GetStockOfTheDayOutput = z.infer<typeof GetStockOfTheDayOutputSchema>;


// Exported function that the application will call
export async function getStockOfTheDay(): Promise<GetStockOfTheDayOutput> {
  return stockOfTheDayFlow();
}


// The main prompt that drives the analysis
const stockOfTheDayPrompt = ai.definePrompt({
  name: 'stockOfTheDayPrompt',
  tools: [getMarketNewsTool],
  output: { schema: GetStockOfTheDayOutputSchema },
  prompt: `
You are an expert stock market analyst for a trading app. Your task is to select a single "Stock of the Day" that is currently making waves in the news.

1.  Use the 'getMarketNews' tool to fetch the latest news headlines for the general market.
2.  Review all the headlines and identify the single most interesting or impactful stock mentioned. This could be due to a major product announcement, earnings surprise, market trend, or significant price movement.
3.  Extract the ticker symbol for that stock. If a clear ticker is not available in the news, find another stock that does have one. You MUST return a valid ticker.
4.  Write a brief, insightful, and compelling analysis (2-3 sentences) explaining why this is the "Stock of the Day."
5.  Create a short, catchy headline for your analysis.

Provide your final output as a single JSON object conforming to the specified output schema.
`,
});


// The main flow that orchestrates the process
const stockOfTheDayFlow = ai.defineFlow(
  {
    name: 'stockOfTheDayFlow',
    outputSchema: GetStockOfTheDayOutputSchema,
  },
  async () => {
    const { output } = await stockOfTheDayPrompt({});
    if (!output) {
      throw new Error("Could not generate Stock of the Day.");
    }
    return output;
  }
);
