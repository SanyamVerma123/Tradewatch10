"use server";

import { suggestPriceAlerts, SuggestPriceAlertsInput } from "@/ai/flows/suggest-price-alerts";

export async function getPriceAlertSuggestions(watchlist: { ticker: string; currentPrice: number }[]) {
  try {
    const input: SuggestPriceAlertsInput = { watchlist };
    const suggestions = await suggestPriceAlerts(input);
    return suggestions;
  } catch (error) {
    console.error("Error getting price alert suggestions:", error);
    // In a real app, you'd want more robust error handling.
    // For now, we return an empty array or throw the error.
    return [];
  }
}
