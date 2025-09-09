import type { Holding, Portfolio } from './types';

// This data now serves as a default/initial state.
// The PortfolioClient will fetch live data and update these values.

export const holdings: Holding[] = [
  {
    id: 'holding-1',
    ticker: 'ZOMATO.NS',
    quantity: 100,
    avgPrice: 180.00,
    investedValue: 18000.00,
    ltp: 185.50,
    dayChange: 2.10,
    dayChangePercent: 1.15,
    pnl: 550.00,
    pnlPercent: 3.06
  },
  {
    id: 'holding-2',
    ticker: 'RELIANCE.NS',
    quantity: 15,
    avgPrice: 2800.40,
    investedValue: 42006.00,
    ltp: 2955.40,
    dayChange: 30.10,
    dayChangePercent: 1.03,
    pnl: 2325.00,
    pnlPercent: 5.53
  },
];

const investedValue = holdings.reduce((acc, h) => acc + h.investedValue, 0);
// Current value, PNL, etc., will be calculated dynamically in PortfolioClient
const currentValue = investedValue; // Placeholder
const totalPnl = 0; // Placeholder
const totalPnlPercent = 0; // Placeholder

export const portfolio: Portfolio = {
  investedValue,
  currentValue,
  totalPnl,
  totalPnlPercent,
  holdings,
};
