import { ClientSDK } from "@sitecore-marketplace-sdk/client";

export interface MarketplaceSdkClient {
  application?: { context?: { sitecoreContextId?: string } };
  mutate?: (queryKey: string, payload?: Record<string, unknown>) => Promise<unknown>;
  query: (queryKey: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

export function asMarketplaceSdkClient(client: ClientSDK): MarketplaceSdkClient {
  return client as unknown as MarketplaceSdkClient;
}
