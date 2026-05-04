import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { ProductRow } from "@/src/lib/domain/product/product.types";
import { asMarketplaceSdkClient } from "@/src/lib/marketplace-client/marketplace-client";
import { resolveSitecoreContextId } from "@/src/lib/marketplace-client/marketplace-context";

const marketplaceProductsQuery = `
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

const sitecoreProductFolderId = "{3F757534-28A6-43F3-9DEA-6DF92C6FFCC2}";

const sitecoreProductsQuery = `
  query {
    item(where: { database: "master", itemId: "${sitecoreProductFolderId}" }) {
      children(first: 10) {
        nodes {
          id: itemId
          model_name: field(name: "ModelName") { value }
          description: field(name: "Description") { value }
          price: field(name: "Price") { value }
          ordercloud_id: field(name: "OrdercloudID") { value }
          quantity: field(name: "Quantity") { value }
          status: field(name: "Status") { value }
        }
      }
    }
  }
`;

function normalizeProduct(value: Record<string, unknown>, index: number): ProductRow {
  return {
    id: String(value.id ?? `row-${index}`),
    modelName: String(value.model_name ?? value.name ?? "N/A"),
    description: String(value.description ?? "N/A"),
    ordercloud_id: String(value.ordercloud_id ?? "N/A"),
    price: Number(value.price ?? 0),
    quantity: Number(value.quantity ?? 0),
    status: String(value.status ?? "unknown"),
  };
}

function extractProductsFromResponse(payload: unknown): ProductRow[] {
  if (!payload || typeof payload !== "object") return [];

  const objectPayload = payload as Record<string, unknown>;
  const queryResultData =
    objectPayload.data && typeof objectPayload.data === "object"
      ? (objectPayload.data as Record<string, unknown>)
      : undefined;
  const data = (queryResultData?.data as Record<string, unknown> | undefined) ?? queryResultData ?? objectPayload;
  const products = data.products;

  if (!Array.isArray(products)) return [];

  return products
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map(normalizeProduct);
}

function mapSitecoreItems(items: unknown[]): ProductRow[] {
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, index) => {
      const modelField = item.model_name as Record<string, unknown> | undefined;
      const descriptionField = item.description as Record<string, unknown> | undefined;
      const ordercloud_idField = item.ordercloud_id as Record<string, unknown> | undefined;
      const priceField = item.price as Record<string, unknown> | undefined;
      const quantityField = item.quantity as Record<string, unknown> | undefined;
      const statusField = item.status as Record<string, unknown> | undefined;

      return {
        id: String(item.id ?? `row-${index}`),
        modelName: String(modelField?.value ?? "N/A"),
        description: String(descriptionField?.value ?? "N/A"),
        ordercloud_id: String(ordercloud_idField?.value ?? "N/A"),
        price: Number(priceField?.value ?? 0),
        quantity: Number(quantityField?.value ?? 0),
        status: String(statusField?.value ?? "Active"),
      };
    });
}

export async function fetchMarketplaceProducts(client: ClientSDK): Promise<ProductRow[]> {
  const queryClient = asMarketplaceSdkClient(client);

  try {
    const sitecoreContextId = await resolveSitecoreContextId(queryClient);

    if (sitecoreContextId) {
      const payload = {
        params: {
          query: { sitecoreContextId },
          body: { query: sitecoreProductsQuery },
        },
      };
      const initialResponse = queryClient.mutate
        ? await queryClient.mutate("xmc.authoring.graphql", payload)
        : await queryClient.query("xmc.authoring.graphql", payload);
      const queryState =
        initialResponse && typeof initialResponse === "object"
          ? (initialResponse as Record<string, unknown>)
          : undefined;
      const shouldRefetch = typeof queryState?.refetch === "function" && queryState.data === undefined;
      const response = shouldRefetch
        ? await (queryState.refetch as () => Promise<unknown>)()
        : initialResponse;
      const responseObject =
        response && typeof response === "object" ? (response as Record<string, unknown>) : undefined;
      const responseData =
        responseObject?.data && typeof responseObject.data === "object"
          ? (responseObject.data as Record<string, unknown>)
          : undefined;
      const itemCandidate =
        responseData?.item ??
        (responseData?.data && typeof responseData.data === "object"
          ? (responseData.data as Record<string, unknown>).item
          : undefined);
      const item =
        itemCandidate && typeof itemCandidate === "object"
          ? (itemCandidate as Record<string, unknown>)
          : undefined;
      const children =
        item?.children && typeof item.children === "object"
          ? (item.children as Record<string, unknown>)
          : undefined;
      const rawItems = Array.isArray(children?.nodes)
        ? (children.nodes as unknown[])
        : Array.isArray(children?.results)
          ? (children.results as unknown[])
          : Array.isArray(children?.edges)
            ? (children.edges as unknown[])
                .map((edge) =>
                  edge && typeof edge === "object"
                    ? (edge as Record<string, unknown>).node
                    : undefined
                )
                .filter((node): node is unknown => node !== undefined)
            : [];

      console.info("[product-query] xmc.authoring.graphql raw response", response);
      console.info("[product-query] xmc.authoring.graphql sitecoreContextId", sitecoreContextId);
      return mapSitecoreItems(rawItems);
    }

    console.warn("[product-query] Missing sitecoreContextId, falling back to application.graphql");

    const initialResponse = await queryClient.query("application.graphql", { query: marketplaceProductsQuery });
    const queryState =
      initialResponse && typeof initialResponse === "object"
        ? (initialResponse as Record<string, unknown>)
        : undefined;
    const shouldRefetch = typeof queryState?.refetch === "function" && queryState.data === undefined;
    const response = shouldRefetch
      ? await (queryState.refetch as () => Promise<unknown>)()
      : initialResponse;
    const products = extractProductsFromResponse(response);
    console.info("[product-query] application.graphql parsed products", products.length);
    return products;
  } catch (error) {
    console.error("[product-query] GraphQL query failed", error);
    return [];
  }
}
