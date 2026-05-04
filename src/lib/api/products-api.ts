import { createHttpClient } from "@/src/lib/api/http-client";
import { CreateProductBody } from "@/src/lib/domain/product/product.types";

const apiClient = createHttpClient();

export async function createProduct(body: CreateProductBody) {
  const response = await apiClient.post("/api/products", body);
  return response.data;
}
