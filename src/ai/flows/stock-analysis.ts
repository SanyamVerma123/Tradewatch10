
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

// Tool to get recent news for a stock
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
        } catch (error) => {
            console.error('Error fetching news:', error);
            return [];
        }
    }
);

// Input schema for the overall flow
const GetStockAnalysisInputSchema = z.object({
  stocks: z.array(
    z.object({
      ticker: z.string().describe('The ticker symbol of the stock.'),
      currentPrice: z.number().describe('The current market price of the stock.'),
    })
  ).describe("The user's selected stocks for analysis."),
});
export type GetStockAnalysisInput = z.infer<typeof GetStockAnalysisInputSchema>;

// Output schema for a single stock's analysis
const StockAnalysisObjectSchema = z.object({
    ticker: z.string().describe('The ticker symbol of the stock.'),
    analysis: z.string().describe('A brief, insightful analysis of the stock based on recent news and price action. Should be 2-3 sentences.'),
    newsSummary: z.string().describe('A summary of the key takeaways from the latest news headlines.'),
    priceAlert: z.object({
        suggestedAlertPrice: z.number().describe('The suggested price to set an alert at.'),
        reason: z.string().describe('The reasoning behind the suggested price alert.'),
    }).describe('A suggested price alert for the stock.'),
});

// Output schema for the overall flow (an array of analyses)
const GetStockAnalysisOutputSchema = z.array(StockAnalysisObjectSchema);
export type GetStockAnalysisOutput = z.infer<typeof GetStockAnalysisOutputSchema>;


// Exported function that the application will call
export async function getStockAnalysis(input: GetStockAnalysisInput): Promise<GetStockAnalysisOutput> {
  return stockAnalysisFlow(input);
}


// The main prompt that drives the analysis
const analysisPrompt = ai.definePrompt({
  name: 'stockAnalysisPrompt',
  tools: [getRecentNewsTool],
  input: { schema: GetStockAnalysisInputSchema },
  output: { schema: GetStockAnalysisOutputSchema },
  prompt: `
You are an expert stock market analyst. Your task is to provide a detailed analysis for each stock provided by the user.

For each stock in the list, you MUST perform the following steps:
1. Use the 'getRecentNews' tool to fetch the latest news headlines for the stock's ticker.
2. Based on the fetched news and the provided current price, write a brief, insightful analysis (2-3 sentences) of the stock's current situation.
3. Summarize the key takeaways from the news headlines in a single paragraph.
4. Suggest a price alert (either above or below the current price) and provide a clear, concise reason for your suggestion. Consider volatility, recent trends, and news sentiment.

Analyze the following stocks:
{{#each stocks}}
- Ticker: {{ticker}}, Current Price: {{currentPrice}}
{{/each}}

Provide your final output as a JSON array, with each object in the array conforming to the specified output schema for a single stock analysis.
`,
});


// The main flow that orchestrates the process
const stockAnalysisFlow = ai.defineFlow(
  {
    name: 'stockAnalysisFlow',
    inputSchema: GetStockAnalysisInputSchema,
    outputSchema: GetStockAnalysisOutputSchema,
  },
  async (input) => {
    // Call the prompt and let it use the tool to get the analysis.
    const { output } = await analysisPrompt(input);
    return output || [];
  }
);
