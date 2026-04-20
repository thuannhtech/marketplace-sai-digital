"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useMarketplaceClient, MarketplaceClientState } from "@/src/utils/hooks/useMarketplaceClient";

interface MarketplaceContextType extends MarketplaceClientState {
  initialize: (attempt?: number) => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const marketplace = useMarketplaceClient();

  return (
    <MarketplaceContext.Provider value={marketplace}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (context === undefined) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider");
  }
  return context;
}
