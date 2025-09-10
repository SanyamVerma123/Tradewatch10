
'use server';

/**
 * @fileOverview An AI agent for detailed stock analysis.
 *
 * - getStockAnalysis - A function that provides analysis, news, and price alerts for selected stocks.
 * - GetStockAnalysisInput - The input type for the getStockAnalysis function.
 * - GetStockAnalysisOutput - The return type for the getStockAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import yahooFinance from 'yahoo-finance2';

const getRecentNewsTool = ai.defineTool(
    {
        name: 'getRecentNews',
        description: 'Get the latest news articles for a given stock ticker.',
        inputSchema: z.object({ ticker: z.string().describe('The stock ticker symbol.') }),
        outputSchema: z.array(z.object({
            uuid: z.string(),
            title: z.string(),
            link: z.string(),
            publisher: z.string(),
            providerPublishTime: z.number(),
        })),
    },
    async ({ ticker }) => {
        try {
            const results = await yahooFinance.search(ticker, { newsCount: 5 });
            return results.news;
        } catch (error) {
            console.error('Error fetching news:', error);
            return [];
        }
    }
);


const GetStockAnalysisInputSchema = z.object({
  stocks: z.array(
    z.object({
      ticker: z.string().describe('The ticker symbol of the stock.'),
      currentPrice: z.number().describe('The current market price of the stock.'),
    })
  ).describe("The user's selected stocks for analysis."),
});
export type GetStockAnalysisInput = z.infer<typeof GetStockAnalysisInputSchema>;

const GetStockAnalysisOutputSchema = z.array(
    z.object({
        ticker: z.string().describe('The ticker symbol of the stock.'),
        analysis: z.string().describe('A brief, insightful analysis of the stock based on recent news and price action. Should be 2-3 sentences.'),
        newsSummary: z.string().describe('A summary of the key takeaways from the latest news headlines.'),
        priceAlert: z.object({
            suggestedAlertPrice: z.number().describe('The suggested price to set an alert at.'),
            reason: z.string().describe('The reasoning behind the suggested price alert.'),
        }).describe('A suggested price alert for the stock.'),
    })
);
export type GetStockAnalysisOutput = z.infer<typeof GetStockAnalysisOutputSchema>;


export async function getStockAnalysis(input: GetStockAnalysisInput): Promise<GetStockAnalysisOutput> {
  return stockAnalysisFlow(input);
}


const analysisPrompt = ai.definePrompt({
  name: 'stockAnalysisPrompt',
  input: { schema: GetStockAnalysisInputSchema },
  output: { schema: GetStockAnalysisOutputSchema },
  tools: [getRecentNewsTool],
  prompt: `You are an expert stock market analyst. For each stock provided by the user, you will perform the following actions:
1. Use the 'getRecentNews' tool to fetch the latest news headlines for the stock's ticker symbol.
2. Based on the news headlines and the current price, provide a brief, insightful analysis (2-3 sentences) of the stock's current situation.
3. Summarize the key takeaways from the news headlines in a single paragraph.
4. Suggest a price alert (either above or below the current price) and provide a clear, concise reason for your suggestion. Consider volatility, recent trends, and news sentiment.

Analyze the following stocks:
{{#each stocks}}
- Ticker: {{ticker}}, Current Price: {{currentPrice}}
{{/each}}

Provide your output in the specified JSON format.
`,
});


const stockAnalysisFlow = ai.defineFlow(
  {
    name: 'stockAnalysisFlow',
    inputSchema: GetStockAnalysisInputSchema,
    outputSchema: GetStockAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await analysisPrompt(input);
    return output!;
  }
);
