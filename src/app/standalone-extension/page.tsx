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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-body-text">
            Extension Dashboard
          </h2>
          <p className="text-sm text-subtle-text">
            Manage and monitor your standalone extension environment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="h-7 bg-background shadow-sm border-sidebar-border">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            SDK v0.2.0
          </Badge>
          <Button variant="outline" size="icon" className="h-9 w-9 bg-background shadow-sm border-sidebar-border">
            <Icon path={mdi.mdiRefresh} className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <AnimatePresence mode="wait">
        {!isInitialized || isLoading || isDataLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-sidebar-border shadow-sm">
                <div className="p-6 space-y-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </Card>
            ))}
          </motion.div>
        ) : appContext ? (
          <motion.div
            key="content"
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {/* Application Details Card */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="h-full border-sidebar-border shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold tracking-tight text-body-text">
                    Application Overview
                  </CardTitle>
                  <Icon path={mdi.mdiApplication} className="h-5 w-5 text-neutral" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    {appContext.iconUrl ? (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-bg p-2 shadow-inner border border-sidebar-border">
                        <img src={appContext.iconUrl} alt={appContext.name} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-background text-primary shadow-inner">
                        <Icon path={mdi.mdiImageOff} size={1.5} />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-body-text">{appContext.name}</h2>
                      <p className="text-sm text-subtle-text">{appContext.type} • {appContext.state}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className="bg-primary-background text-primary hover:bg-neutral-hover border-sidebar-border">
                          ID: {appContext.id.slice(0, 8)}...
                        </Badge>
                        <Badge colorScheme="primary" className="bg-info-background text-info border-sidebar-border">
                          {appContext.url?.split('//')[1]?.split('/')[0] || 'Local Environment'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6 bg-sidebar-border" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle-text">Installation ID</span>
                      <p className="font-mono text-sm text-body-text truncate">{appContext.installationId}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle-text">Status</span>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-medium text-body-text capitalize">{appContext.state}</span>
                        <span className="h-2 w-2 rounded-full bg-success" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions Card */}
            <motion.div variants={item}>
              <Card className="h-full border-sidebar-border shadow-sm transition-all hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight text-body-text">Quick Actions</CardTitle>
                  <CardDescription className="text-subtle-text">Common tools for this extension.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 pt-2">
                  <Button variant="outline" className="justify-start gap-3 bg-background border-sidebar-border hover:bg-neutral-hover" asChild>
                    <a href={appContext.url} target="_blank" rel="noopener noreferrer">
                      <Icon path={mdi.mdiOpenInNew} className="h-4 w-4" />
                      Open Application
                    </a>
                  </Button>
                  <Button variant="outline" className="justify-start gap-3 bg-background border-sidebar-border hover:bg-neutral-hover">
                    <Icon path={mdi.mdiCog} className="h-4 w-4" />
                    Configure Settings
                  </Button>
                  <Button variant="outline" className="justify-start gap-3 bg-background border-sidebar-border hover:bg-neutral-hover">
                    <Icon path={mdi.mdiDatabase} className="h-4 w-4" />
                    View Data Logs
                  </Button>
                  <Separator className="my-2 bg-sidebar-border" />
                  <Button className="w-full bg-primary text-primary-fg hover:bg-primary-hover">
                    Sync Context
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Statistics/Monitoring Placeholder */}
            <motion.div variants={item} className="lg:col-span-3">
              <Card className="border-sidebar-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight text-body-text">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-sidebar-border text-subtle-text">
                    <div className="flex flex-col items-center gap-2">
                      <Icon path={mdi.mdiChartTimelineVariant} size={1.5} />
                      <p className="text-sm">Monitoring data will appear here shortly</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="mt-12 text-center pb-6">
        <p className="text-xs text-subtle-text uppercase tracking-widest font-medium opacity-60">
          © 2026 Sitecore Marketplace • Powered by Blok Design System
        </p>
      </footer>
    </div>
  );
}

export default StandaloneExtension;
