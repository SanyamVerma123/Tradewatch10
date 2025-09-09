import type { Holding, Portfolio } from './types';

export const holdings: Holding[] = [
  {
    id: 'holding-1',
    ticker: 'IDEA',
    quantity: 1000,
    avgPrice: 6.00,
    investedValue: 6000.00,
    ltp: 6.55,
    dayChange: 1.25,
    dayChangePercent: 20.38,
    pnl: 550.00,
    pnlPercent: 9.17
  },
  {
    id: 'holding-2',
    ticker: 'RELIANCE',
    quantity: 37,
    avgPrice: 1464.40,
    investedValue: 54182.80,
    ltp: 1464.40,
    dayChange: 0.00,
    dayChangePercent: 0.00,
    pnl: 19650.00, // This is a bit unrealistic but matching the image
    pnlPercent: 36.27
  },
];

const investedValue = 60765.32;
const currentValue = 82326.12;
const totalPnl = currentValue - investedValue;
const totalPnlPercent = (totalPnl / investedValue) * 100;

export const portfolio: Portfolio = {
  investedValue,
  currentValue,
  totalPnl,
  totalPnlPercent,
  holdings: holdings.map(h => {
    const currentValue = h.ltp * h.quantity;
    return {
      ...h,
      currentValue,
    }
  }),
};
