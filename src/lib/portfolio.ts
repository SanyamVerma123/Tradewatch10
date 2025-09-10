

import type { Holding, Portfolio, Position } from './types';

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

export const positions: Position[] = [];

// This function will now be used to initialize the portfolio state
// but the actual state will be managed in PortfolioClient and localStorage.
export const getInitialPortfolio = (): Portfolio => {
    const investedValue = holdings.reduce((acc, h) => acc + (h.avgPrice * h.quantity), 0);
    
    // In a real scenario, current value and PNL would be calculated based on live prices.
    // For the initial state, we can base it on the static LTP in the holdings data.
    const currentValue = holdings.reduce((acc, h) => acc + (h.ltp * h.quantity), 0);
    const totalPnl = currentValue - investedValue;
    const totalPnlPercent = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;
    
    return {
      investedValue,
      currentValue,
      totalPnl,
      totalPnlPercent,
      dayPnl: 0,
      dayPnlPercent: 0,
      holdings,
      positions,
    };
};

export const portfolio: Portfolio = getInitialPortfolio();
    