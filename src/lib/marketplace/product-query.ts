import { ClientSDK } from "@sitecore-marketplace-sdk/client";

export interface ProductRow {
  id: string;
  modelName: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
  status: string;
}

const productGraphqlQuery = `
  query ProductListing {
    products {
      id
      model_name
      category
      catalog
      price
      quantity
      status
    }
  }
`;

function normalizeProduct(value: Record<string, unknown>, index: number): ProductRow {
  return {
    id: String(value.id ?? `row-${index}`),
    modelName: String(value.model_name ?? value.name ?? "N/A"),
    category: String(value.category ?? "N/A"),
    catalog: String(value.catalog ?? "N/A"),
    price: Number(value.price ?? 0),
    quantity: Number(value.quantity ?? 0),
    status: String(value.status ?? "unknown"),
  };
}

function extractProductsFromResponse(payload: unknown): ProductRow[] {
  if (!payload || typeof payload !== "object") return [];

  const objectPayload = payload as Record<string, unknown>;
  const data = (objectPayload.data as Record<string, unknown> | undefined) ?? objectPayload;
  const products = data.products;

  if (!Array.isArray(products)) return [];

  return products
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map(normalizeProduct);
}

export async function fetchMarketplaceProducts(client: ClientSDK): Promise<ProductRow[]> {
  const queryClient = client as unknown as {
    query: (queryKey: string, payload?: Record<string, unknown>) => Promise<unknown>;
  };

  const attempts: Array<() => Promise<unknown>> = [
    () => queryClient.query("graphql", { query: productGraphqlQuery }),
    () => queryClient.query("application.graphql", { query: productGraphqlQuery }),
    () => queryClient.query("products.list"),
  ];

  for (const run of attempts) {
    try {
      const response = await run();
      const products = extractProductsFromResponse(response);
      if (products.length > 0) return products;
    } catch {
      // Continue to the next query strategy.
    }
  }

  return [];
}
