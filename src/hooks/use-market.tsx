
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type Market = 'IN' | 'US';
type Currency = 'INR' | 'USD';

interface MarketContextType {
  market: Market;
  setMarket: (market: Market) => void;
  currency: Currency;
  currencySymbol: string;
  setCurrency: (currency: Currency) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [market, setMarketState] = useState<Market>('IN');
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedMarket = localStorage.getItem('market') as Market | null;
    const storedCurrency = localStorage.getItem('currency') as Currency | null;
    if (storedMarket) {
      setMarketState(storedMarket);
    }
    if (storedCurrency) {
      setCurrencyState(storedCurrency);
    } else {
        // Infer currency from market if not set
        if (storedMarket === 'US') {
            setCurrencyState('USD');
        }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('market', market);
      // Auto-switch currency when market changes
      const newCurrency = market === 'IN' ? 'INR' : 'USD';
      setCurrencyState(newCurrency);
      localStorage.setItem('currency', newCurrency);
    }
  }, [market, isInitialized]);
  
  useEffect(() => {
    if (isInitialized) {
        localStorage.setItem('currency', currency);
    }
  }, [currency, isInitialized]);


  const setMarket = (newMarket: Market) => {
    setMarketState(newMarket);
  };
  
  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
  }

  const currencySymbol = currency === 'INR' ? '₹' : '$';

  return (
    <MarketContext.Provider value={{ market, setMarket, currency, setCurrency, currencySymbol }}>
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
