"use client";

import * as mdi from "@mdi/js";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/lib/icon";

interface Report104InventoryRow {
  id: string;
  purchasedBy: string;
  accountManager: string;
  market: string;
  transactionDate: string;
  transactionReceipt: string;
  transactionStatus: string;
  productId: string;
  product: string;
  quantityPurchased: number;
  unitCost: number;
  amount: number;
  inventoryBalanceQuantity: number;
  convertedEticketsQuantity: number;
  expiryDate: string;
  validityStatus: string;
}

interface Report104Summary {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalQuantityPurchased: number;
  totalAmount: number;
  availableInventory: number;
  convertedEtickets: number;
  expiredItems: number;
}

interface Report104Response {
  rows: Report104InventoryRow[];
  summary: Report104Summary;
  lastSyncUtc: string;
}

interface FabricSyncResponse {
  filePath?: string;
  fileName?: string;
  rowCount?: number;
  uploadedAtUtc?: string;
  error?: string;
}

interface ReportCachePayload extends Report104Response {
  cachedAtUtc: string;
}

type TableColumnKey =
  | "purchasedBy"
  | "transactionDate"
  | "transactionReceipt"
  | "transactionStatus"
  | "product"
  | "quantityPurchased"
  | "unitCost"
  | "amount"
  | "inventoryBalanceQuantity";

const emptySummary: Report104Summary = {
  totalTransactions: 0,
  successfulTransactions: 0,
  failedTransactions: 0,
  totalQuantityPurchased: 0,
  totalAmount: 0,
  availableInventory: 0,
  convertedEtickets: 0,
  expiredItems: 0,
};

const reportCacheKey = "Transactions";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const csvColumns: { header: string; value: (row: Report104InventoryRow) => unknown }[] = [
  { header: "purchased_by", value: (row) => row.purchasedBy },
  { header: "transaction_date", value: (row) => row.transactionDate },
  { header: "receipt", value: (row) => row.transactionReceipt },
  { header: "status", value: (row) => row.transactionStatus },
  { header: "product_id", value: (row) => row.productId },
  { header: "qty", value: (row) => row.quantityPurchased },
  { header: "unit_cost", value: (row) => row.unitCost },
  { header: "amount", value: (row) => row.amount },
  { header: "inventory_balance", value: (row) => row.inventoryBalanceQuantity },
  { header: "validity", value: (row) => row.validityStatus },
];

const tableColumns: {
  key: TableColumnKey;
  label: string;
  render: (row: Report104InventoryRow) => ReactNode;
}[] = [
  {
    key: "purchasedBy",
    label: "Purchased By",
    render: (row) => <span className="font-medium text-body-text">{row.purchasedBy}</span>,
  },
  {
    key: "transactionDate",
    label: "Transaction Date",
    render: (row) => row.transactionDate,
  },
  {
    key: "transactionReceipt",
    label: "Receipt",
    render: (row) => row.transactionReceipt,
  },
  {
    key: "transactionStatus",
    label: "Status",
    render: (row) => (
      <Badge colorScheme={/fail|cancel|declin|problem/i.test(row.transactionStatus) ? "danger" : "success"}>
        {row.transactionStatus}
      </Badge>
    ),
  },
  {
    key: "product",
    label: "Products",
    render: (row) => row.product,
  },
  {
    key: "quantityPurchased",
    label: "Qty",
    render: (row) => row.quantityPurchased,
  },
  {
    key: "unitCost",
    label: "Unit Cost",
    render: (row) => formatCurrency(row.unitCost),
  },
  {
    key: "amount",
    label: "Amount",
    render: (row) => <span className="font-medium text-body-text">{formatCurrency(row.amount)}</span>,
  },
  {
    key: "inventoryBalanceQuantity",
    label: "Inventory Balance",
    render: (row) => row.inventoryBalanceQuantity,
  },
];

const defaultVisibleColumns = tableColumns.reduce(
  (visibleColumns, column) => ({
    ...visibleColumns,
    [column.key]: true,
  }),
  {} as Record<TableColumnKey, boolean>,
);

function formatTimestampForFileName(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toReport104Csv(rows: Report104InventoryRow[]) {
  const header = csvColumns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) => csvColumns.map((column) => escapeCsvCell(column.value(row))).join(","));

  return [header, ...body].join("\r\n");
}

function readReportCache(): ReportCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const cachedValue = window.localStorage.getItem(reportCacheKey);
    if (!cachedValue) return null;

    const cachedReport = JSON.parse(cachedValue) as Partial<ReportCachePayload>;
    if (!Array.isArray(cachedReport.rows) || !cachedReport.summary) return null;

    return {
      rows: cachedReport.rows,
      summary: { ...emptySummary, ...cachedReport.summary },
      lastSyncUtc: cachedReport.lastSyncUtc || "",
      cachedAtUtc: cachedReport.cachedAtUtc || "",
    };
  } catch {
    return null;
  }
}

function writeReportCache(data: Report104Response) {
  if (typeof window === "undefined") return;

  try {
    const cachePayload: ReportCachePayload = {
      rows: data.rows || [],
      summary: data.summary || emptySummary,
      lastSyncUtc: data.lastSyncUtc || "",
      cachedAtUtc: new Date().toISOString(),
    };

    window.localStorage.setItem(reportCacheKey, JSON.stringify(cachePayload));
  } catch {
    // Cache is a performance optimization; the report should keep working if storage is unavailable.
  }
}

interface ChartDatum {
  label: string;
  value: number;
}

interface ChartDefinition {
  title: string;
  axisLabel: string;
  data: ChartDatum[];
  color?: "blue" | "orange";
}

function truncateLabel(value: string, maxLength = 18): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function groupRows(rows: Report104InventoryRow[], getLabel: (row: Report104InventoryRow) => unknown, limit = 6): ChartDatum[] {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const rawLabel = getLabel(row);
    const label = rawLabel === null || rawLabel === undefined || rawLabel === "" ? "N/A" : String(rawLabel);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function HorizontalBarChart({ title, axisLabel, data, color = "blue" }: ChartDefinition) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const barColor = color === "orange" ? "bg-[#e66a3a]" : "bg-[#2d8df0]";
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    setBarsReady(false);
    const animationFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setBarsReady(true));
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [data, title]);

  return (
    <div className="rounded-md border border-sidebar-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-body-text">{title}</h3>
          <p className="mt-1 text-[11px] text-subtle-text">{axisLabel}</p>
        </div>
        <Icon path={mdi.mdiDotsHorizontal} className="h-4 w-4 shrink-0 text-subtle-text" />
      </div>

      <div className="mt-4 space-y-3">
        {data.length > 0 ? (
          data.map((item, index) => (
            <div key={item.label} className="grid grid-cols-[88px_1fr_24px] items-center gap-2 text-xs">
              <span className="truncate text-right text-subtle-text" title={item.label}>
                {truncateLabel(item.label)}
              </span>
              <div className="h-7 overflow-hidden border-l border-dotted border-blackAlpha-300 bg-muted/40">
                <div
                  className={`report-chart-bar relative flex h-7 items-center justify-end overflow-hidden px-2 text-[11px] font-semibold text-white shadow-sm transition-[width] duration-1000 ease-out ${barColor}`}
                  style={{
                    width: barsReady ? `${Math.max((item.value / maxValue) * 100, 10)}%` : "0%",
                    animationDelay: `${index * 140}ms`,
                    transitionDelay: `${index * 140}ms`,
                  }}
                >
                  <span className="relative z-10">{item.value}</span>
                </div>
              </div>
              <span className="text-subtle-text">{item.value}</span>
            </div>
          ))
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-subtle-text">No chart data</div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  const [rows, setRows] = useState<Report104InventoryRow[]>([]);
  const [summary, setSummary] = useState<Report104Summary>(emptySummary);
  const [lastSyncUtc, setLastSyncUtc] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingFabric, setIsSyncingFabric] = useState(false);
  const [error, setError] = useState("");
  const [fabricMessage, setFabricMessage] = useState("");
  const [fabricError, setFabricError] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Record<TableColumnKey, boolean>>(defaultVisibleColumns);

  async function loadReportData(options: { preferCache?: boolean; background?: boolean } = {}) {
    const cachedReport = options.preferCache ? readReportCache() : null;

    if (cachedReport) {
      setRows(cachedReport.rows);
      setSummary(cachedReport.summary);
      setLastSyncUtc(cachedReport.lastSyncUtc);
      setIsLoading(false);
    } else if (!options.background) {
      setIsLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/ordercloud/report-104", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as Partial<Report104Response> & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Product and inventory analytics API failed with status ${response.status}.`);
      }
      
      const reportData: Report104Response = {
        rows: data.rows || [],
        summary: data.summary || emptySummary,
        lastSyncUtc: data.lastSyncUtc || "",
      };
      const hasTransactionChange =
        !cachedReport || cachedReport.summary.totalTransactions !== reportData.summary.totalTransactions;

      writeReportCache(reportData);

      if (hasTransactionChange || !options.background) {
        setRows(reportData.rows);
        setSummary(reportData.summary);
        setLastSyncUtc(reportData.lastSyncUtc);
      }
    } catch (loadError) {
      if (!cachedReport) {
        setRows([]);
        setSummary(emptySummary);
        setLastSyncUtc("");
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load product and inventory analytics data from OrderCloud.");
    }

    setIsLoading(false);
  }

  async function syncToFabric() {
    setIsSyncingFabric(true);
    setFabricMessage("");
    setFabricError("");

    try {
      const response = await fetch("/api/fabric/report-104/sync", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as FabricSyncResponse;

      if (!response.ok) {
        throw new Error(data.error || `Fabric sync failed with status ${response.status}.`);
      }

      setFabricMessage(
        `Uploaded ${data.rowCount ?? 0} rows as ${data.fileName || data.filePath || "CSV file"} to Sitecore Connect${data.uploadedAtUtc ? ` at ${new Date(data.uploadedAtUtc).toLocaleString()}` : ""}`,
      );
    } catch (syncError) {
      setFabricError(syncError instanceof Error ? syncError.message : "Failed to upload product and inventory analytics CSV to Sitecore Connect.");
    }

    setIsSyncingFabric(false);
  }

  function exportCsv() {
    const fileName = `orders_${formatTimestampForFileName(new Date())}.csv`;
    const csv = toReport104Csv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleColumn(columnKey: TableColumnKey) {
    setVisibleColumns((currentColumns) => ({
      ...currentColumns,
      [columnKey]: !currentColumns[columnKey],
    }));
  }

  useEffect(() => {
    void loadReportData({ preferCache: true, background: true });
  }, []);

  const metricCards = useMemo(
    () => [
      { label: "Transactions", value: summary.totalTransactions.toLocaleString(), scheme: "primary" as const },
      { label: "Successful", value: summary.successfulTransactions.toLocaleString(), scheme: "success" as const },
      { label: "Failed", value: summary.failedTransactions.toLocaleString(), scheme: "danger" as const },
      { label: "Purchased Qty", value: summary.totalQuantityPurchased.toLocaleString(), scheme: "cyan" as const },
      { label: "Amount", value: formatCurrency(summary.totalAmount), scheme: "warning" as const },
      { label: "Inventory Balance", value: summary.availableInventory.toLocaleString(), scheme: "neutral" as const },
    ],
    [summary],
  );

  const fabricCharts = useMemo<ChartDefinition[]>(
    () => [
      {
        title: "Count of amount by status",
        axisLabel: "status",
        data: groupRows(rows, (row) => row.transactionStatus, 5),
      },
      {
        title: "Count of amount by qty",
        axisLabel: "qty",
        data: groupRows(rows, (row) => row.quantityPurchased, 5),
      },
      {
        title: "Count of amount by inventory_balance",
        axisLabel: "inventory_balance",
        data: groupRows(rows, (row) => row.inventoryBalanceQuantity, 6),
      },
      {
        title: "Count of amount by purchased_by",
        axisLabel: "purchased_by",
        data: groupRows(rows, (row) => row.purchasedBy, 6),
      },
      {
        title: "Count of amount by unit_cost",
        axisLabel: "unit_cost",
        data: groupRows(rows, (row) => row.unitCost, 6),
      },
      {
        title: "Count of product inventory analytics by receipt",
        axisLabel: "receipt",
        data: groupRows(rows, (row) => row.transactionReceipt, 7),
        color: "orange",
      },
    ],
    [rows],
  );

  const visibleTableColumns = useMemo(
    () => tableColumns.filter((column) => visibleColumns[column.key]),
    [visibleColumns],
  );

  const tableColumnCount = Math.max(visibleTableColumns.length, 1);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge colorScheme="primary">Report Product & Inventory Analytics Demo</Badge>
            <Badge colorScheme="success">OrderCloud to Microsoft Fabric</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-body-text">
            Report Product & Inventory Analytics Demo
          </h1>
          <p className="mt-2 text-sm leading-6 text-subtle-text">
            This dashboard demonstrates product and inventory analytics across transaction status,
            purchased quantity, inventory balance, eTicket conversion, expiry, and validity status.
            OrderCloud is the primary data source, with data synchronized through Sitecore Connect
            into Microsoft Fabric for analytics and reporting.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[460px]">
          {[
            ["Source", "OrderCloud"],
            ["Middleware", "Sitecore Connect"],
            ["Warehouse", "Fabric Lakehouse"],
            ["Report", "Power BI"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-sidebar-border bg-white px-3 py-3">
              <p className="text-xs text-subtle-text">{label}</p>
              <p className="mt-1 text-sm font-semibold text-body-text">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="border-sidebar-border" padding="md">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-body-text">Live OrderCloud Data</h2>
              <p className="text-sm text-subtle-text">
                Pulls orders, line items, products, users, and buyer data using the mapped OC environment variables.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lastSyncUtc ? (
                <Badge colorScheme="neutral">Last sync {new Date(lastSyncUtc).toLocaleString()}</Badge>
              ) : null}
              <Button variant="outline" className="border-sidebar-border" onClick={() => void loadReportData()} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                    Loading
                  </>
                ) : (
                  <>
                    <Icon path={mdi.mdiRefresh} className="h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <Button variant="outline" className="border-sidebar-border" onClick={exportCsv} disabled={isLoading || rows.length === 0}>
                <Icon path={mdi.mdiDownload} className="h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={() => void syncToFabric()} disabled={isLoading || isSyncingFabric || rows.length === 0}>
                {isSyncingFabric ? (
                  <>
                    <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                    Syncing
                  </>
                ) : (
                  <>
                    <Icon path={mdi.mdiDatabaseArrowUpOutline} className="h-4 w-4" />
                    Sync to Fabric
                  </>
                )}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-danger-bg-active bg-danger-bg px-4 py-3 text-sm text-danger-fg">
              {error}
            </div>
          ) : null}

          {fabricMessage ? (
            <div className="rounded-md border border-success-bg-active bg-success-bg px-4 py-3 text-sm text-success-fg">
              {fabricMessage}
            </div>
          ) : null}

          {fabricError ? (
            <div className="rounded-md border border-danger-bg-active bg-danger-bg px-4 py-3 text-sm text-danger-fg">
              {fabricError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((metric) => (
              <div key={metric.label} className="rounded-md border border-sidebar-border bg-white p-4">
                <p className="text-xs text-subtle-text">{metric.label}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-xl font-bold text-body-text">{metric.value}</p>
                  <Badge colorScheme={metric.scheme}>OC</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-sidebar-border bg-white px-4 py-4">
            <div className="flex flex-col gap-3 border-b border-sidebar-border pb-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xl font-medium text-body-text">Quick summary</p>
                <p className="text-sm text-subtle-text">product_inventory_analytics</p>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-body-text">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-1 bg-[#2d8df0]" />
                  <span>
                    <strong>{summary.totalAmount.toLocaleString()}</strong>
                    <span className="ml-2 text-subtle-text">Sum of amount</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-1 bg-[#e66a3a]" />
                  <span>
                    <strong>{rows.length.toLocaleString()}</strong>
                    <span className="ml-2 text-subtle-text">Count of product inventory analytics</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {fabricCharts.map((chart) => (
                <HorizontalBarChart key={chart.title} {...chart} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border" padding="md">
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-body-text">Microsoft Fabric Report</h2>
              <p className="text-sm text-subtle-text">Embedded Product & Inventory Analytics report from Microsoft Fabric.</p>
            </div>
            <Badge colorScheme="cyan">Fabric</Badge>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-sidebar-border bg-white">
            <iframe
              title="Demo"
              src="https://app.fabric.microsoft.com/reportEmbed?reportId=054078ac-cb9d-450e-a02c-213245b097f4&autoAuth=true&ctid=0a9f795b-a1ab-4108-b2ca-d4fc6425bc1c"
              className="h-[541px] w-full"
              allowFullScreen
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border" padding="md">
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-body-text">Product & Inventory Analytics Rows</h2>
              <p className="text-sm text-subtle-text">
                These rows are the same shape that should be landed into Fabric gold table for the report.
              </p>
            </div>
            <Badge colorScheme={rows.length > 0 ? "success" : "neutral"}>
              {rows.length} rows
            </Badge>
          </div>

          <div className="mt-4 rounded-md border border-sidebar-border bg-white px-4 py-3">
            <p className="text-sm font-semibold text-body-text">Columns</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {tableColumns.map((column) => (
                <label
                  key={column.key}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-sidebar-border bg-background px-3 text-sm text-body-text"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-sidebar-border">
            <div className="w-full overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                style={{ minWidth: `${Math.max(visibleTableColumns.length * 150, 560)}px` }}
              >
                <thead className="bg-muted">
                  <tr className="border-b border-sidebar-border">
                    {visibleTableColumns.length > 0 ? (
                      visibleTableColumns.map((column) => (
                        <th key={column.key} className="px-4 py-3 font-semibold">
                          {column.label}
                        </th>
                      ))
                    ) : (
                      <th className="px-4 py-3 font-semibold">No columns selected</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-subtle-text" colSpan={tableColumnCount}>
                        <span className="inline-flex items-center gap-2">
                          <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                          Loading product and inventory analytics from OrderCloud...
                        </span>
                      </td>
                    </tr>
                  ) : visibleTableColumns.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-subtle-text" colSpan={tableColumnCount}>
                        Select at least one column to view table data.
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-subtle-text" colSpan={tableColumnCount}>
                        No inventory reporting rows found from OrderCloud.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-sidebar-border/70 last:border-b-0">
                        {visibleTableColumns.map((column) => (
                          <td key={column.key} className="px-4 py-3 text-body-text">
                            {column.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
