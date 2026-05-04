"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as mdi from "@mdi/js";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplace } from "@/src/providers/MarketplaceProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/icon";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function StandaloneExtension() {
  const { client, error, isInitialized, isLoading } = useMarketplace();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    if (!error && isInitialized && client) {
      setIsDataLoading(true);
      client.query("application.context")
        .then((res) => {
          setAppContext(res.data);
        })
        .catch((err) => {
          console.error("Error retrieving application.context:", err);
        })
        .finally(() => {
          setIsDataLoading(false);
        });
    }
  }, [client, error, isInitialized]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md border-danger-bg bg-danger-bg text-danger-fg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon path={mdi.mdiAlertCircle} className="h-5 w-5 text-danger" />
              Initialization Error
            </CardTitle>
            <CardDescription className="text-danger-fg opacity-80">
              {String(error)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="default"
              colorScheme="danger"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
    </div>
  );
}

export default StandaloneExtension;
