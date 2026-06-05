"use client";

import * as mdi from "@mdi/js";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/lib/icon";

const reportFields = [
  "Purchased by (Company name)",
  "Transaction date",
  "Transaction receipt",
  "Transaction status (successful/failed)",
  "Products",
  "Quantity purchase",
  "Unit cost",
  "Amount",
  "Inventory Balance quantity",
  "Validity status (available/expired)",
];

const fabricTables = [
  {
    name: "dim_company",
    source: "OrderCloud Buyers / Users",
    fields: "Company name, buyer segment",
  },
  {
    name: "dim_product",
    source: "OrderCloud Products",
    fields: "Product ID, product name, catalog, category, unit cost",
  },
  {
    name: "fact_inventory_transaction",
    source: "Orders + Line Items + xp",
    fields: "Transaction date, receipt, status, quantity, amount",
  },
  {
    name: "fact_inventory_balance",
    source: "Products + Inventory xp",
    fields: "Balance quantity, validity status",
  },
];

const connectSteps = [
  "OrderCloud: create an API Client with read scopes for Buyers, Users, Orders, LineItems, Products, Catalogs, and Inventory-related xp fields.",
  "Environment: store OC_CLIENT_ID, OC_CLIENT_SECRET, OC_BUYER_ID, OC_BASE_URL, FABRIC_TENANT_ID, FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET, FABRIC_WORKSPACE_ID, and FABRIC_LAKEHOUSE_ID.",
  "Fabric: create Workspace, Lakehouse, and four bronze tables for raw buyers, products, orders, and line items.",
  "Sitecore Connect: create a scheduled recipe that authenticates to OC, pulls changed records by LastModifiedDate, and writes JSON payloads to OneLake.",
  "Fabric Dataflow Gen2 or Notebook: flatten bronze JSON into silver tables, then calculate Report 104 gold tables.",
  "Power BI: connect to the Fabric semantic model and build Inventory Status Reporting visuals by market, company, product, validity status, and transaction status.",
  "Monitoring: log recipe run ID, source count, landed count, rejected rows, retry count, and last successful sync time.",
];

const architectureNodes = [
  {
    title: "B2B Storefront",
    subtitle: "Commerce user buys products and eTickets",
    icon: mdi.mdiStorefrontOutline,
    className: "lg:col-start-1 lg:row-start-1",
  },
  {
    title: "Sitecore AI CMS",
    subtitle: "Content, product pages, Experience Edge",
    icon: mdi.mdiSitemapOutline,
    className: "lg:col-start-2 lg:row-start-1",
  },
  {
    title: "Microsoft Fabric",
    subtitle: "Report 104 lakehouse and semantic model",
    icon: mdi.mdiDatabaseCogOutline,
    className: "lg:col-start-2 lg:row-start-2",
    highlight: true,
  },
  {
    title: "Sitecore Connect",
    subtitle: "Integration middleware, API orchestration",
    icon: mdi.mdiTransitConnectionVariant,
    className: "lg:col-start-3 lg:row-start-2",
    highlight: true,
  },
  {
    title: "OrderCloud",
    subtitle: "B2B marketplace, orders, products, inventory xp",
    icon: mdi.mdiCloudOutline,
    className: "lg:col-start-3 lg:row-start-3",
  },
  {
    title: "Admin Portal",
    subtitle: "User, catalog, order, promotion, report management",
    icon: mdi.mdiMonitorDashboard,
    className: "lg:col-start-2 lg:row-start-3",
  },
  {
    title: "External Systems",
    subtitle: "Salesforce, SIAH, SDC, OSP, payment, finance",
    icon: mdi.mdiHubspot,
    className: "lg:col-start-4 lg:row-start-1 lg:row-span-3",
  },
];

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
          data.map((item) => (
            <div key={item.label} className="grid grid-cols-[88px_1fr_24px] items-center gap-2 text-xs">
              <span className="truncate text-right text-subtle-text" title={item.label}>
                {truncateLabel(item.label)}
              </span>
              <div className="h-7 border-l border-dotted border-blackAlpha-300 bg-muted/40">
                <div
                  className={`flex h-7 items-center justify-end px-2 text-[11px] font-semibold text-white ${barColor}`}
                  style={{ width: `${Math.max((item.value / maxValue) * 100, 10)}%` }}
                >
                  {item.value}
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

function ArchitectureNode({
  title,
  subtitle,
  icon,
  className,
  highlight,
}: {
  title: string;
  subtitle: string;
  icon: string;
  className: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 border-dashed p-4 ${
        highlight ? "border-primary bg-primary-bg/45" : "border-blackAlpha-300 bg-white"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${highlight ? "bg-primary text-white" : "bg-muted text-body-text"}`}>
          <Icon path={icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-body-text">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-subtle-text">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ConnectorLabel({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`hidden text-center text-[11px] font-semibold uppercase text-subtle-text lg:block ${className}`}>
      <div className="mx-auto h-px w-full border-t border-dashed border-blackAlpha-400" />
      <span className="mt-1 inline-block">{children}</span>
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

  async function loadReportData() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ordercloud/report-104", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as Partial<Report104Response> & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Report 104 API failed with status ${response.status}.`);
      }
      
      setRows(data.rows || []);
      setSummary(data.summary || emptySummary);     
      setLastSyncUtc(data.lastSyncUtc || "");
    } catch (loadError) {
      setRows([]);
      setSummary(emptySummary);
      setLastSyncUtc("");
      setError(loadError instanceof Error ? loadError.message : "Unable to load Report 104 data from OrderCloud.");
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
      setFabricError(syncError instanceof Error ? syncError.message : "Failed to upload Report 104 CSV to Sitecore Connect.");
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

  useEffect(() => {
    void loadReportData();
  }, []);

  const metricCards = useMemo(
    () => [
      { label: "Transactions", value: summary.totalTransactions.toLocaleString(), scheme: "primary" as const },
      { label: "Successful", value: summary.successfulTransactions.toLocaleString(), scheme: "success" as const },
      { label: "Failed", value: summary.failedTransactions.toLocaleString(), scheme: "danger" as const },
      { label: "Purchased Qty", value: summary.totalQuantityPurchased.toLocaleString(), scheme: "cyan" as const },
      { label: "Amount", value: formatCurrency(summary.totalAmount), scheme: "warning" as const },
      { label: "Inventory Balance", value: summary.availableInventory.toLocaleString(), scheme: "neutral" as const },
      { label: "Expired", value: summary.expiredItems.toLocaleString(), scheme: "danger" as const },
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
        title: "Count of gold_report104 by receipt",
        axisLabel: "receipt",
        data: groupRows(rows, (row) => row.transactionReceipt, 7),
        color: "orange",
      },
    ],
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge colorScheme="primary">Report 104</Badge>
            <Badge colorScheme="cyan">Product & Inventory Analytics</Badge>
            <Badge colorScheme="success">OrderCloud to Microsoft Fabric</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-body-text">
            Inventory Status Reporting
          </h1>
          <p className="mt-2 text-sm leading-6 text-subtle-text">
            Trang này mô phỏng report 104 trong requirement: inventory tracking, conversion metrics,
            transaction status, quantity balance, eTicket conversion, expiry, and validity status.
            Data source chính là OrderCloud, được đẩy qua Sitecore Connect vào Microsoft Fabric để làm semantic model/report.
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
                <p className="text-sm text-subtle-text">gold_report104</p>
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
                    <span className="ml-2 text-subtle-text">Count of gold_report104</span>
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
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-body-text">Architecture giống mẫu</h2>
              <p className="text-sm text-subtle-text">
                OC nằm trong marketplace, Sitecore Connect làm integration middleware, Microsoft Fabric giữ reporting database.
              </p>
            </div>
            <Badge colorScheme="warning">API / SFTP / OneLake</Badge>
          </div>

          <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-3">
            {architectureNodes.map((node) => (
              <ArchitectureNode key={node.title} {...node} />
            ))}

            <ConnectorLabel className="lg:col-start-1 lg:row-start-1 lg:translate-x-[82%] lg:translate-y-[72px]">
              Data publishing
            </ConnectorLabel>
            <ConnectorLabel className="lg:col-start-2 lg:row-start-2 lg:translate-x-[82%] lg:translate-y-[72px]">
              Fabric API
            </ConnectorLabel>
            <ConnectorLabel className="lg:col-start-3 lg:row-start-2 lg:translate-y-[150px]">
              OC API
            </ConnectorLabel>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-sidebar-border" padding="md">
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-body-text">Report 104 Required Fields</h2>
                <p className="mt-1 text-sm text-subtle-text">Minimum fields from Product & Inventory Analytics.</p>
              </div>
              <Badge colorScheme="primary">Inventory</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {reportFields.map((field) => (
                <div key={field} className="flex items-center gap-2 rounded-md border border-sidebar-border bg-white px-3 py-2 text-sm">
                  <Icon path={mdi.mdiCheckCircleOutline} className="h-4 w-4 shrink-0 text-success" />
                  <span className="text-body-text">{field}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sidebar-border" padding="md">
          <CardContent>
            <h2 className="text-lg font-semibold text-body-text">Fabric Data Model</h2>
            <p className="mt-1 text-sm text-subtle-text">
              Bronze giữ raw JSON từ OC. Silver flatten dữ liệu. Gold phục vụ report 104.
            </p>
            <div className="mt-4 overflow-hidden rounded-md border border-sidebar-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted">
                  <tr className="border-b border-sidebar-border">
                    <th className="px-4 py-3 font-semibold">Fabric Table</th>
                    <th className="px-4 py-3 font-semibold">OC Source</th>
                    <th className="px-4 py-3 font-semibold">Report Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricTables.map((table) => (
                    <tr key={table.name} className="border-b border-sidebar-border/70 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-body-text">{table.name}</td>
                      <td className="px-4 py-3 text-body-text">{table.source}</td>
                      <td className="px-4 py-3 leading-6 text-subtle-text">{table.fields}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.75fr]">
        <Card className="border-sidebar-border" padding="md">
          <CardContent>
            <h2 className="text-lg font-semibold text-body-text">Step-by-step Connect OC với Microsoft Fabric</h2>
            <div className="mt-4 space-y-3">
              {connectSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-md border border-sidebar-border bg-white p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-body-text">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sidebar-border" padding="md">
          <CardContent className="space-y-4">
            <h2 className="text-lg font-semibold text-body-text">API Contract gợi ý</h2>
            <div className="rounded-md bg-gray-900 p-4 font-mono text-xs leading-6 text-gray-100">
              <p>GET /orders?dateUpdated=&#123;lastSyncUtc&#125;</p>
              <p>GET /orders/&#123;id&#125;/lineitems</p>
              <p>GET /products?dateUpdated=&#123;lastSyncUtc&#125;</p>
              <p>GET /buyers?dateUpdated=&#123;lastSyncUtc&#125;</p>
              <p>POST /fabric/onelake/report-104/bronze/&#123;entity&#125;</p>
            </div>
            <div className="rounded-md border border-warning-bg-active bg-warning-bg px-4 py-3">
              <p className="text-sm font-semibold text-warning-fg">Implementation note</p>
              <p className="mt-1 text-sm leading-6 text-body-text">
                Report 104 cần inventory fields như balance, converted eTickets, expiry, validity.
                Nếu các field này chưa có trong standard OC schema, nên lưu trong Product xp hoặc LineItem xp
                rồi flatten sang Fabric.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-sidebar-border" padding="md">
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-body-text">Report 104 Inventory Rows</h2>
              <p className="text-sm text-subtle-text">
                These rows are the same shape that should be landed into Fabric gold table for the report.
              </p>
            </div>
            <Badge colorScheme={rows.length > 0 ? "success" : "neutral"}>
              {rows.length} rows
            </Badge>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-sidebar-border">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left text-sm">
                <thead className="bg-muted">
                  <tr className="border-b border-sidebar-border">
                    <th className="px-4 py-3 font-semibold">Purchased By</th>
                    <th className="px-4 py-3 font-semibold">Transaction Date</th>
                    <th className="px-4 py-3 font-semibold">Receipt</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Products</th>
                    <th className="px-4 py-3 font-semibold">Qty</th>
                    <th className="px-4 py-3 font-semibold">Unit Cost</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Inventory Balance</th>
                    <th className="px-4 py-3 font-semibold">Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-subtle-text" colSpan={10}>
                        <span className="inline-flex items-center gap-2">
                          <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                          Loading Report 104 from OrderCloud...
                        </span>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-subtle-text" colSpan={10}>
                        No inventory reporting rows found from OrderCloud.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-sidebar-border/70 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-body-text">{row.purchasedBy}</td>
                        <td className="px-4 py-3 text-body-text">{row.transactionDate}</td>
                        <td className="px-4 py-3 text-body-text">{row.transactionReceipt}</td>
                        <td className="px-4 py-3">
                          <Badge colorScheme={/fail|cancel|declin|problem/i.test(row.transactionStatus) ? "danger" : "success"}>
                            {row.transactionStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-body-text">{row.product}</td>
                        <td className="px-4 py-3 text-body-text">{row.quantityPurchased}</td>
                        <td className="px-4 py-3 text-body-text">{formatCurrency(row.unitCost)}</td>
                        <td className="px-4 py-3 font-medium text-body-text">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-3 text-body-text">{row.inventoryBalanceQuantity}</td>
                        <td className="px-4 py-3">
                          <Badge colorScheme={row.validityStatus.toLowerCase() === "expired" ? "warning" : "primary"}>
                            {row.validityStatus}
                          </Badge>
                        </td>
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
