import { createHttpClient } from "@/src/lib/api/http-client";

const defaultWorkatoUrl =
  "https://apim.jp.workato.com/brotherj/create-product-v1/create-product";

export interface CreateProductPayload {
  model_name: string;
  desc: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
}

export interface WorkatoCreateProductResponse {
  [key: string]: unknown;
}

function getWorkatoApiConfig() {
  const endpoint = process.env.WORKATO_CREATE_PRODUCT_URL ?? defaultWorkatoUrl;
  const apiToken = process.env.WORKATO_API_TOKEN;

  if (!apiToken) {
    throw new Error("Missing WORKATO_API_TOKEN in environment variables.");
  }

  return { endpoint, apiToken };
}

export async function createProductWithWorkato(payload: CreateProductPayload) {
  const { endpoint, apiToken } = getWorkatoApiConfig();
  const client = createHttpClient({
    headers: {
      "api-token": apiToken,
    },
  });

  const response = await client.post<WorkatoCreateProductResponse>(endpoint, payload);
  return response.data;
}
