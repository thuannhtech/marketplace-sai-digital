import axios from "axios";
import { createHttpClient } from "@/src/lib/api/http-client";
import { CreateProductBody } from "@/src/lib/domain/product/product.types";
import { updateProductWithWorkato } from "@/src/lib/integrations/workato/workato-product-api";

const apiClient = createHttpClient();

export interface ProductMutationResponse {
  success: boolean;
  data: unknown;
}

export async function createProduct(body: CreateProductBody) {
  try {
    const response = await apiClient.post<ProductMutationResponse>("/api/products", body);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const message =
          typeof record.message === "string"
            ? record.message
            : typeof record.Message === "string"
              ? record.Message
              : undefined;

        if (message) {
          throw new Error(message);
        }
      }
    }

    throw error;
  }
}

export async function updateProduct(id: string, body: CreateProductBody & { ordercloud_id?: string }) {
  return await updateProductWithWorkato({
    id,
    itemId: id,
    ...body,
  });
}
