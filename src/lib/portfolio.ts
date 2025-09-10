

import type { Holding, Portfolio, Position } from './types';

// This data now serves as a default/initial state.
// The PortfolioClient will fetch live data and update these values.

export const holdings: Holding[] = [];

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
    