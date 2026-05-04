import { createHttpClient } from "@/src/lib/api/http-client";

export interface CreateProductPayload {
  model_name: string;
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

export interface WorkatoCreateProductResponse {
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

  const response = await client.post<WorkatoCreateProductResponse>("create-product-v1/create-product", payload);
  return response.data;
}
