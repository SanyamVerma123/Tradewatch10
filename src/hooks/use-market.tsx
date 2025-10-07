
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Market = 'IN' | 'US' | 'GB' | 'DE' | 'JP' | 'HK' | 'CA';
export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY' | 'HKD' | 'CAD';

export const marketDetails: Record<Market, { name: string, currency: Currency, symbol: string, initialBalance: number, open: number, close: number, offset: number, weekend_closure: number[] }> = {
  IN: { name: 'India', currency: 'INR', symbol: '₹', initialBalance: 500000, open: 9.25, close: 15.5, offset: 5.5, weekend_closure: [0, 6] },
  US: { name: 'United States', currency: 'USD', symbol: '$', initialBalance: 5000, open: 9.5, close: 16, offset: -4, weekend_closure: [0, 6] },
  GB: { name: 'United Kingdom', currency: 'GBP', symbol: '£', initialBalance: 4000, open: 8, close: 16.5, offset: 1, weekend_closure: [0, 6] },
  DE: { name: 'Germany', currency: 'EUR', symbol: '€', initialBalance: 4500, open: 9, close: 17.5, offset: 2, weekend_closure: [0, 6] },
  JP: { name: 'Japan', currency: 'JPY', symbol: '¥', initialBalance: 750000, open: 9, close: 15, offset: 9, weekend_closure: [0, 6] },
  HK: { name: 'Hong Kong', currency: 'HKD', symbol: 'HK$', initialBalance: 40000, open: 9.5, close: 16, offset: 8, weekend_closure: [0, 6] },
  CA: { name: 'Canada', currency: 'CAD', symbol: '$', initialBalance: 6500, open: 9.5, close: 16, offset: -4, weekend_closure: [0, 6] },
};

interface MarketContextType {
  market: Market;
  setMarket: (market: Market) => void;
  currency: Currency;
  currencySymbol: string;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [market, setMarketState] = useState<Market>('IN');
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [currencySymbol, setCurrencySymbolState] = useState('₹');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
        const storedMarket = localStorage.getItem('market') as Market | null;
        if (storedMarket && marketDetails[storedMarket]) {
          setMarketState(storedMarket);
          const details = marketDetails[storedMarket];
          setCurrencyState(details.currency);
          setCurrencySymbolState(details.symbol);
        }
    } catch (error) {
        console.error("Could not access localStorage:", error);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
          localStorage.setItem('market', market);
          const details = marketDetails[market];
          setCurrencyState(details.currency);
          setCurrencySymbolState(details.symbol);
      } catch (error) {
          console.error("Could not access localStorage:", error);
      }
    }
  }, [market, isInitialized]);

  const setMarket = (newMarket: Market) => {
    if (marketDetails[newMarket]) {
      setMarketState(newMarket);
    }
  };

  return (
    <MarketContext.Provider value={{ market, setMarket, currency, currencySymbol }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
};
