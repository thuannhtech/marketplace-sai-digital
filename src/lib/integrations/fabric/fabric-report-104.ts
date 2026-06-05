import axios from "axios";
import type { Report104InventoryRow, Report104Summary } from "@/src/app/actions/ordercloud";

interface FabricUploadInput {
  rows: Report104InventoryRow[];
  summary: Report104Summary;
  lastSyncUtc: string;
}

interface FabricUploadResult {
  filePath: string;
  rowCount: number;
  uploadedAtUtc: string;
  fileName: string;
  workatoResponse?: unknown;
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

function getEnvValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return "";
}

function getSitecoreConnectConfig() {
  const baseUrl = getEnvValue("WORKATO_URL", "NEXT_PUBLIC_WORKATO_URL");
  const apiToken = getEnvValue("WORKATO_TOKEN", "NEXT_PUBLIC_WORKATO_TOKEN");

  if (!baseUrl) {
    throw new Error("Missing WORKATO_URL (or NEXT_PUBLIC_WORKATO_URL) in environment variables.");
  }

  if (!apiToken) {
    throw new Error("Missing WORKATO_TOKEN (or NEXT_PUBLIC_WORKATO_TOKEN) in environment variables.");
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiToken };
}

function formatTimestampForFileName(date: Date): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");

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

function getAxiosErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data;
  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message =
      typeof record.Message === "string"
        ? record.Message
        : typeof record.message === "string"
          ? record.message
          : typeof record.error === "string"
            ? record.error
            : undefined;

    if (message) return message;
  }

  return fallback;
}

export async function uploadReport104ToFabric(input: FabricUploadInput): Promise<FabricUploadResult> {
  const { baseUrl, apiToken } = getSitecoreConnectConfig();
  const uploadedAtUtc = new Date().toISOString();
  const fileName = `orders_${formatTimestampForFileName(new Date(uploadedAtUtc))}.csv`;
  const csv = toReport104Csv(input.rows);
  const formData = new FormData();

  formData.set("File", new Blob([csv], { type: "text/csv" }), fileName);
  formData.set("FileName", fileName);

  try {
    const response = await axios.post(`${baseUrl}/product-v1/sync-farbic`, formData, {
      headers: {
        "api-token": apiToken,
      },
      timeout: 60_000,
    });

    return {
      filePath: fileName,
      fileName,
      rowCount: input.rows.length,
      uploadedAtUtc,
      workatoResponse: response.data,
    };
  } catch (error) {
    throw new Error(getAxiosErrorMessage(error, "Failed to upload Report 104 CSV to Sitecore Connect."));
  }
}
