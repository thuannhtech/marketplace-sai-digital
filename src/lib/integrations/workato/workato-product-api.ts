import axios from "axios";
import { createHttpClient } from "@/src/lib/api/http-client";

export interface CreateProductPayload {
  language: string;
  model_name: string;
  price_name?: string;
  desc: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
  images?: {
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }[];
  MediaItemIds?: string;
}

export interface UpdateProductPayload extends CreateProductPayload {
  id: string;
  itemId?: string;
  ordercloud_id?: string;
}

export interface WorkatoCreateProductResponse {
  [key: string]: unknown;
}

export interface WorkatoUpdateProductResponse {
  [key: string]: unknown;
}

function getWorkatoApiConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_WORKATO_URL;
  const apiToken = process.env.NEXT_PUBLIC_WORKATO_TOKEN;

  if (!apiToken) {
    throw new Error("Missing WORKATO_API_TOKEN in environment variables.");
  }

  return { baseUrl, apiToken };
}

export async function createProductWithWorkato(payload: CreateProductPayload) {
  const { baseUrl, apiToken } = getWorkatoApiConfig();
  if (!baseUrl) {
    throw new Error("Missing WORKATO_CREATE_PRODUCT_URL (or SITECORECONNECT_CREATE_PRODUCT_URL) in environment variables.");
  }
  const client = createHttpClient({
    baseURL: baseUrl,
    headers: {
      "api-token": apiToken,
    },
  });

  try {
    const response = await client.post<WorkatoCreateProductResponse>("product-v1/create-product", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;

      if (typeof data === "string" && data.trim()) {
        throw new Error(data);
      }

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

        if (message) {
          throw new Error(message);
        }
      }
    }

    throw error;
  }
}

export async function updateProductWithWorkato(payload: UpdateProductPayload) {
  const { baseUrl, apiToken } = getWorkatoApiConfig();
  if (!baseUrl) {
    throw new Error("Missing WORKATO_CREATE_PRODUCT_URL (or SITECORECONNECT_CREATE_PRODUCT_URL) in environment variables.");
  }
  const client = createHttpClient({
    baseURL: baseUrl,
    headers: {
      "api-token": apiToken,
    },
  });

  try {
    const response = await client.put<WorkatoUpdateProductResponse>("product-v1/update-product", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;

      if (typeof data === "string" && data.trim()) {
        throw new Error(data);
      }

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

        if (message) {
          throw new Error(message);
        }
      }
    }

    throw error;
  }
}
