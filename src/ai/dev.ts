import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-price-alerts.ts';
import '@/ai/flows/support-flow.ts';
import '@/ai/flows/stock-analysis.ts';
import '@/ai/flows/stock-of-the-day.ts';
