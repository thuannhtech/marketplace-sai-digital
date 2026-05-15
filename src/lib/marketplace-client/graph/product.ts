import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { ProductRow } from "@/src/lib/domain/product/product.types";
import { asMarketplaceSdkClient } from "@/src/lib/marketplace-client/client";
import { resolveSitecoreContextId } from "@/src/lib/marketplace-client/context";

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
const SITECORE_PRODUCTS_FETCH_LIMIT = 100;

function buildSitecoreProductsQuery(language?: string): string {
  const normalizedLanguage = language?.trim() || "en";

  return `
  query {
    item(where: { database: "master", itemId: "${sitecoreProductFolderId}", language: "${normalizedLanguage.replace(/"/g, '\\"')}" }) {
      children(
        first: ${SITECORE_PRODUCTS_FETCH_LIMIT}
      ) {
        nodes {
          id: itemId
          created_date: field(name: "__Created") { value }
          model_name: field(name: "ModelName") { value }
          description: field(name: "Description") { value }
          price: field(name: "Price") { value }
          ordercloud_id: field(name: "OrderCloudProductId") { value }
          quantity: field(name: "Quantity") { value }
          status: field(name: "Status") { value }
          media_item_ids: field(name: "Images") { value }
        }
      }
    }
  }`;
}

function buildSitecoreProductByIdQuery(itemId: string, language?: string): string {
  const normalizedLanguage = language?.trim() || "en";
  const normalizedItemId = itemId.trim().replace(/"/g, '\\"');

  return `
  query {
    item(where: { database: "master", itemId: "${normalizedItemId}", language: "${normalizedLanguage.replace(/"/g, '\\"')}" }) {
      id: itemId
      created_date: field(name: "__Created") { value }
      model_name: field(name: "ModelName") { value }
      description: field(name: "Description") { value }
      price: field(name: "Price") { value }
      ordercloud_id: field(name: "OrderCloudProductId") { value }
      quantity: field(name: "Quantity") { value }
      status: field(name: "Status") { value }
      media_item_ids: field(name: "Images") { value }
    }
  }`;
}

const publishProductToEdgeMutation = `
  mutation PublishProductToEdge(
    $itemId: ID!,
    $languages: [String!]!,
    $publishSubItems: Boolean!,
    $publishRelatedItems: Boolean!
  ) {
    publishItem(input: {
      sourceDatabase: "master",
      targetDatabases: ["experienceedge"],
      rootItemIds: [$itemId],
      publishSubItems: $publishSubItems,
      publishRelatedItems: $publishRelatedItems,
      publishItemMode: SMART,
      languages: $languages
    }) {
      operationId
    }
  }
`;

const deleteProductItemMutation = `
  mutation DeleteProductItem($itemId: ID!, $permanently: Boolean!) {
    deleteItem(input: {
      itemId: $itemId
      permanently: $permanently
    }) {
      successful
    }
  }
`;

const updateProductStatusMutation = `
  mutation UpdateProductStatus($itemId: ID!, $status: String!, $language: String!) {
    updateItem(
      input: {
        database: "master"
        itemId: $itemId
        language: $language
        fields: [{ name: "Status", value: $status, reset: false }]
      }
    ) {
      item {
        itemId
        status: field(name: "Status") { value }
      }
    }
  }
`;

const updateProductNeverPublishMutation = `
  mutation UpdateProductNeverPublish($itemId: ID!, $language: String!, $value: String!) {
    updateItem(
      input: {
        database: "master"
        itemId: $itemId
        language: $language
        fields: [{ name: "__Never publish", value: $value, reset: false }]
      }
    ) {
      item {
        itemId
        neverPublish: field(name: "__Never publish") { value }
      }
    }
  }
`;

const publishingStatusQuery = `
  query PublishingStatus($publishingOperationId: String!) {
    publishingStatus(publishingOperationId: $publishingOperationId) {
      state
      isDone
      isFailed
      processed
      targetDatabase {
        name
      }
    }
  }
`;

function parseMediaItemIds(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split("|")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeProduct(value: Record<string, unknown>, index: number): ProductRow {
  return {
    id: String(value.id ?? `row-${index}`),
    language: typeof value.language === "string" ? value.language : undefined,
    version: typeof value.version === "number" ? value.version : undefined,
    modelName: String(value.model_name ?? value.name ?? "N/A"),
    description: String(value.description ?? "N/A"),
    ordercloud_id: String(value.ordercloud_id ?? "N/A"),
    price: Number(value.price ?? 0),
    quantity: Number(value.quantity ?? 0),
    status: String(value.status ?? "unknown"),
    createdDate:
      typeof value.created_date === "string"
        ? value.created_date
        : typeof value.createdDate === "string"
          ? value.createdDate
          : typeof value.CreatedDate === "string"
            ? value.CreatedDate
            : undefined,
    mediaItemIds: parseMediaItemIds(value.media_item_ids),
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
      const createdDateField = item.created_date as Record<string, unknown> | undefined;
      const descriptionField = item.description as Record<string, unknown> | undefined;
      const ordercloud_idField = item.ordercloud_id as Record<string, unknown> | undefined;
      const priceField = item.price as Record<string, unknown> | undefined;
      const quantityField = item.quantity as Record<string, unknown> | undefined;
      const statusField = item.status as Record<string, unknown> | undefined;
      const mediaItemIdsField = item.media_item_ids as Record<string, unknown> | undefined;

      return {
        id: String(item.id ?? `row-${index}`),
        language: typeof item.language === "string" ? item.language : undefined,
        version: typeof item.version === "number" ? item.version : undefined,
        modelName: String(modelField?.value ?? "N/A"),
        description: String(descriptionField?.value ?? "N/A"),
        ordercloud_id: String(ordercloud_idField?.value ?? "N/A"),
        price: Number(priceField?.value ?? 0),
        quantity: Number(quantityField?.value ?? 0),
        status: String(statusField?.value ?? "Active"),
        createdDate: typeof createdDateField?.value === "string" ? createdDateField.value : undefined,
        mediaItemIds: parseMediaItemIds(mediaItemIdsField?.value),
      };
    });
}

function toTimestamp(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function hasNonEmptyStatus(product: ProductRow): boolean {
  return typeof product.status === "string" && product.status.trim().length > 0;
}

async function executeAuthoringGraphql(
  client: ClientSDK,
  body: Record<string, unknown>,
): Promise<unknown> {
  const queryClient = asMarketplaceSdkClient(client);
  const sitecoreContextId = await resolveSitecoreContextId(queryClient);

  if (!sitecoreContextId) {
    throw new Error("Missing sitecoreContextId. Unable to call authoring GraphQL.");
  }

  const payload = {
    params: {
      query: { sitecoreContextId },
      body,
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

  return shouldRefetch ? await (queryState.refetch as () => Promise<unknown>)() : initialResponse;
}

function extractPublishOperationId(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const publishItem =
    source?.publishItem && typeof source.publishItem === "object"
      ? (source.publishItem as Record<string, unknown>)
      : undefined;
  const operationId = publishItem?.operationId;

  return typeof operationId === "string" && operationId.length > 0 ? operationId : undefined;
}

function extractDeleteSuccessful(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const deleteItem =
    source?.deleteItem && typeof source.deleteItem === "object"
      ? (source.deleteItem as Record<string, unknown>)
      : undefined;

  return deleteItem?.successful === true;
}

function extractUpdatedProductStatus(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const updateItem =
    source?.updateItem && typeof source.updateItem === "object"
      ? (source.updateItem as Record<string, unknown>)
      : undefined;
  const item =
    updateItem?.item && typeof updateItem.item === "object"
      ? (updateItem.item as Record<string, unknown>)
      : undefined;
  const statusField =
    item?.status && typeof item.status === "object"
      ? (item.status as Record<string, unknown>)
      : undefined;
  const value = statusField?.value;

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function extractUpdatedNeverPublish(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const updateItem =
    source?.updateItem && typeof source.updateItem === "object"
      ? (source.updateItem as Record<string, unknown>)
      : undefined;
  const item =
    updateItem?.item && typeof updateItem.item === "object"
      ? (updateItem.item as Record<string, unknown>)
      : undefined;
  const neverPublishField =
    item?.neverPublish && typeof item.neverPublish === "object"
      ? (item.neverPublish as Record<string, unknown>)
      : undefined;
  const value = neverPublishField?.value;

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

interface PublishingStatusResult {
  state?: string;
  isDone: boolean;
  isFailed: boolean;
}

function extractPublishingStatus(response: unknown): PublishingStatusResult | undefined {
  if (!response || typeof response !== "object") return undefined;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const publishingStatus =
    source?.publishingStatus && typeof source.publishingStatus === "object"
      ? (source.publishingStatus as Record<string, unknown>)
      : undefined;

  if (!publishingStatus) return undefined;

  return {
    state: typeof publishingStatus.state === "string" ? publishingStatus.state : undefined,
    isDone: publishingStatus.isDone === true,
    isFailed: publishingStatus.isFailed === true,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchMarketplaceProducts(
  client: ClientSDK,
  params?: { language?: string },
): Promise<ProductRow[]> {
  const queryClient = asMarketplaceSdkClient(client);
  const sitecoreProductsQuery = buildSitecoreProductsQuery(params?.language);

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
    return products.filter(hasNonEmptyStatus);
  } catch (error) {
    console.error("[product-query] GraphQL query failed", error);
    throw error;
  }
}

export async function fetchMarketplaceProductById(
  client: ClientSDK,
  params: { itemId: string; language?: string },
): Promise<ProductRow | null> {
  const itemId = params.itemId.trim();
  if (!itemId) {
    throw new Error("Missing itemId for product query.");
  }

  const response = await executeAuthoringGraphql(client, {
    query: buildSitecoreProductByIdQuery(itemId, params.language),
  });

  if (!response || typeof response !== "object") return null;

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : undefined;
  const nestedData =
    data?.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : undefined;
  const source = nestedData ?? data;
  const item =
    source?.item && typeof source.item === "object"
      ? (source.item as Record<string, unknown>)
      : undefined;

  if (!item) return null;

  return mapSitecoreItems([item])[0] ?? null;
}

export async function publishProductToEdge(
  client: ClientSDK,
  params: { itemId: string; languages?: string[]; publishSubItems?: boolean; publishRelatedItems?: boolean },
): Promise<{ operationId: string }> {
  const itemId = params.itemId.trim();
  if (!itemId) {
    throw new Error("Missing itemId for local publish.");
  }

  const languages =
    params.languages?.map((language) => language.trim()).filter((language) => language.length > 0) ??
    ["en", "vi", "ja-JP"];

  const response = await executeAuthoringGraphql(client, {
    query: publishProductToEdgeMutation,
    variables: {
      itemId,
      languages,
      publishSubItems: params.publishSubItems ?? false,
      publishRelatedItems: params.publishRelatedItems ?? false,
    },
  });
  const operationId = extractPublishOperationId(response);

  if (!operationId) {
    throw new Error("Edge publish did not return an operationId.");
  }

  return { operationId };
}

export async function deleteProductFromGraph(
  client: ClientSDK,
  params: { itemId: string; permanently?: boolean },
): Promise<{ successful: true }> {
  const itemId = params.itemId.trim();
  if (!itemId) {
    throw new Error("Missing itemId for delete.");
  }

  const response = await executeAuthoringGraphql(client, {
    query: deleteProductItemMutation,
    variables: {
      itemId,
      permanently: params.permanently ?? true,
    },
  });

  if (!extractDeleteSuccessful(response)) {
    throw new Error("Delete item did not return successful=true.");
  }

  return { successful: true };
}

export async function updateProductStatusInGraph(
  client: ClientSDK,
  params: { itemId: string; status: string; language?: string },
): Promise<{ status: string }> {
  const itemId = params.itemId.trim();
  const status = params.status.trim();
  const language = params.language?.trim() || "en";

  if (!itemId) {
    throw new Error("Missing itemId for status update.");
  }

  if (!status) {
    throw new Error("Missing status for status update.");
  }

  const response = await executeAuthoringGraphql(client, {
    query: updateProductStatusMutation,
    variables: {
      itemId,
      status,
      language,
    },
  });
  const updatedStatus = extractUpdatedProductStatus(response);

  if (!updatedStatus) {
    throw new Error("Update item did not return the Status field value.");
  }

  return { status: updatedStatus };
}

export async function updateProductNeverPublishInGraph(
  client: ClientSDK,
  params: { itemId: string; language?: string; value?: boolean },
): Promise<{ value: string }> {
  const itemId = params.itemId.trim();
  const language = params.language?.trim() || "en";
  const value = params.value === false ? "0" : "1";

  if (!itemId) {
    throw new Error("Missing itemId for never publish update.");
  }

  const response = await executeAuthoringGraphql(client, {
    query: updateProductNeverPublishMutation,
    variables: {
      itemId,
      language,
      value,
    },
  });
  const updatedValue = extractUpdatedNeverPublish(response);

  if (!updatedValue) {
    throw new Error("Update item did not return the __Never publish field value.");
  }

  return { value: updatedValue };
}

export async function waitForPublishCompletion(
  client: ClientSDK,
  params: { operationId: string; timeoutMs?: number; pollIntervalMs?: number },
): Promise<{ state?: string }> {
  const operationId = params.operationId.trim();
  if (!operationId) {
    throw new Error("Missing operationId for publishing status.");
  }

  const timeoutMs = params.timeoutMs ?? 120000;
  const pollIntervalMs = params.pollIntervalMs ?? 3000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await executeAuthoringGraphql(client, {
      query: publishingStatusQuery,
      variables: {
        publishingOperationId: operationId,
      },
    });

    const status = extractPublishingStatus(response);
    if (status?.isFailed) {
      throw new Error(`Publishing failed${status.state ? `: ${status.state}` : "."}`);
    }

    if (status?.isDone) {
      return { state: status.state };
    }

    await delay(pollIntervalMs);
  }

  throw new Error("Timed out waiting for publishing to complete.");
}
