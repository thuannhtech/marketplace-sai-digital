// utils/hooks/useMarketplaceClient.ts

import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { XMC } from "@sitecore-marketplace-sdk/xmc";

export interface MarketplaceClientState {
  client: ClientSDK | null;
  error: Error | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export interface UseMarketplaceClientOptions {
  /**
   * Number of retry attempts when initialization fails
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Whether to automatically initialize the client
   * @default true
   */
  autoInit?: boolean;
}

const DEFAULT_OPTIONS: Required<UseMarketplaceClientOptions> = {
  retryAttempts: 3,
  retryDelay: 1000,
  autoInit: true,
};

let client: ClientSDK | undefined = undefined;

const NON_RETRYABLE_ERROR_PREFIX = "MARKETPLACE_NON_RETRYABLE:";

function isEmbeddedInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function getMarketplaceTarget() {
  const targetMode = process.env.NEXT_PUBLIC_MARKETPLACE_TARGET ?? "auto";

  if (targetMode === "self") return window;

  if (targetMode === "parent") {
    if (!isEmbeddedInIframe()) {
      throw new Error(
        `${NON_RETRYABLE_ERROR_PREFIX} NEXT_PUBLIC_MARKETPLACE_TARGET=parent requires iframe host.`,
      );
    }
    return window.parent;
  }

  if (isEmbeddedInIframe()) return window.parent;

  throw new Error(
    `${NON_RETRYABLE_ERROR_PREFIX} Marketplace host is unavailable in standalone mode.`,
  );
}

function isRetryableInitializationError(error: unknown) {
  if (!(error instanceof Error)) return true;
  if (error.message.startsWith(NON_RETRYABLE_ERROR_PREFIX)) return false;
  if (error.message.includes("Invalid message origin")) return false;
  return true;
}

async function getMarketplaceClient() {
  if (client) {
    return client;
  }

  const config = {
    target: getMarketplaceTarget(),
    modules: [XMC],
  };

  client = await ClientSDK.init(config);
  return client;
}

export function useMarketplaceClient(options: UseMarketplaceClientOptions = {}) {
  // Memoize the options to prevent unnecessary re-renders
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options,
  ]);

  const [state, setState] = useState<MarketplaceClientState>({
    client: null,
    error: null,
    isLoading: false,
    isInitialized: false,
  });

  // Use ref to track if we're currently initializing to prevent race conditions
  const isInitializingRef = useRef(false);

  const initializeClient = useCallback(async (attempt = 1): Promise<void> => {
    // Use functional state update to check current state without dependencies
    let shouldProceed = false;
    setState(prev => {
      if (prev.isLoading || prev.isInitialized || isInitializingRef.current) {
        return prev;
      }
      shouldProceed = true;
      isInitializingRef.current = true;
      return { ...prev, isLoading: true, error: null };
    });

    if (!shouldProceed) return;

    try {
      const client = await getMarketplaceClient();
      setState({
        client,
        error: null,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      if (isRetryableInitializationError(error) && attempt < opts.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
        return initializeClient(attempt + 1);
      }

      setState({
        client: null,
        error:
          error instanceof Error
            ? new Error(error.message.replace(NON_RETRYABLE_ERROR_PREFIX, "").trim())
            : new Error("Failed to initialize MarketplaceClient"),
        isLoading: false,
        isInitialized: false,
      });
    } finally {
      isInitializingRef.current = false;
    }
  }, [opts.retryAttempts, opts.retryDelay]); // Removed state dependencies

  useEffect(() => {
    if (opts.autoInit) {
      initializeClient();
    }

    return () => {
      isInitializingRef.current = false;
      setState({
        client: null,
        error: null,
        isLoading: false,
        isInitialized: false,
      });
    };
  }, [opts.autoInit, initializeClient]);

  // Memoize the return value to prevent object recreation on every render
  return useMemo(() => ({
    ...state,
    initialize: initializeClient,
  }), [state, initializeClient]);
}