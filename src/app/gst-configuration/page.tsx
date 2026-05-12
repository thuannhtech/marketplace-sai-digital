"use client";

import { useEffect, useState } from "react";
import * as mdi from "@mdi/js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/lib/icon";
import { fetchGstConfiguration, updateGstConfigurationInGraph } from "@/src/lib/marketplace-client";
import { useMarketplace } from "@/src/providers/MarketplaceProvider";

function parseGstValue(value: string) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.min(numericValue, 100);
}

export default function GstConfigurationPage() {
  const { client, error: marketplaceError, isInitialized, isLoading } = useMarketplace();
  const [gstValue, setGstValue] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !isInitialized) {
      return;
    }

    const marketplaceClient = client;
    let isMounted = true;

    async function loadGstConfiguration() {
      setIsPageLoading(true);
      setError("");

      try {
        const value = await fetchGstConfiguration(marketplaceClient);
        if (isMounted) {
          setGstValue(value);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load GST configuration.");
        }
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    }

    void loadGstConfiguration();

    return () => {
      isMounted = false;
    };
  }, [client, isInitialized]);

  async function handleUpdate() {
    if (!client) {
      setError("Marketplace client is not ready.");
      return;
    }

    const marketplaceClient = client;

    if (gstValue < 0 || gstValue > 100) {
      setError("GST % must be between 0 and 100.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const updatedValue = await updateGstConfigurationInGraph(marketplaceClient, gstValue);
      setGstValue(updatedValue);
      setToast("GST configuration updated successfully.");
      setTimeout(() => setToast(null), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update GST configuration.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-4 top-4 z-[80]">
          <div className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
            {toast}
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Gst Configuration</h1>
      </div>

      {marketplaceError ? (
        <Alert variant="destructive">
          <AlertDescription>{marketplaceError.message}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="max-w-xl border-sidebar-border">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>GST %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={gstValue}
              onChange={(event) => setGstValue(parseGstValue(event.target.value))}
              disabled={isLoading || isPageLoading || isSaving || !client}
            />
            <p className="text-xs text-subtle-text">Enter a value from 0 to 100.</p>
          </div>

          <div className="flex items-center justify-end">
            <Button onClick={() => void handleUpdate()} disabled={isLoading || isPageLoading || isSaving || !client}>
              {isSaving ? (
                <>
                  <Icon path={mdi.mdiLoading} className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
