
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Market = 'IN' | 'US' | 'GB' | 'DE' | 'JP' | 'HK' | 'CA';
export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY' | 'HKD' | 'CAD';

export const marketDetails: Record<Market, { name: string, currency: Currency, symbol: string, initialBalance: number }> = {
  IN: { name: 'India', currency: 'INR', symbol: '₹', initialBalance: 500000 },
  US: { name: 'United States', currency: 'USD', symbol: '$', initialBalance: 5000 },
  GB: { name: 'United Kingdom', currency: 'GBP', symbol: '£', initialBalance: 4000 },
  DE: { name: 'Germany', currency: 'EUR', symbol: '€', initialBalance: 4500 },
  JP: { name: 'Japan', currency: 'JPY', symbol: '¥', initialBalance: 750000 },
  HK: { name: 'Hong Kong', currency: 'HKD', symbol: 'HK$', initialBalance: 40000 },
  CA: { name: 'Canada', currency: 'CAD', symbol: '$', initialBalance: 6500 },
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
