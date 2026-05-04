import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { asMarketplaceSdkClient } from "@/src/lib/marketplace-client/marketplace-client";
import { resolveSitecoreContextId } from "@/src/lib/marketplace-client/marketplace-context";

const requestUploadUrlMutation = `
  mutation RequestUploadUrl($itemPath: String!) {
    uploadMedia(input: { itemPath: $itemPath }) {
      presignedUploadUrl
    }
  }
`;
const SITECORE_MEDIA_LIBRARY_PREFIX = "/sitecore/media library/";

const getMediaItemQuery = `
  query GetMediaItem($itemId: String!) {
    item(where: { database: "master", itemId: $itemId }) {
      itemId
      name
      path
      url
    }
  }
`;

interface MediaLibraryResponse {
  data?: {
    item?: {
      children?: {
        nodes: Array<{
          itemId: string;
          name: string;
          path: string;
        }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

const listMediaItemsQuery = `
  query ListMediaItems($folderId: ID!, $first: PaginationAmount!) {
    item(where: { database: "master", itemId: $folderId }) {
      children(first: $first) {
        nodes {
          itemId
          name
          path
          url
        }
      }
    }
  }
`;

/** Experience Edge GraphQL (delivery) — public media URL from `item.url.url`. */
const edgeMediaItemUrlQuery = `
  query EdgeMediaItemUrl($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      url {
        url
      }
    }
  }
`;

/** Experience Edge — list folder children with public `url.url` (same shape as your curl `ListMediaUrls`). */
const edgeListMediaChildrenQuery = `
  query ListMediaUrls($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      children {
        results {
          id
          name
          path
          url {
            url
          }
        }
      }
    }
  }
`;

export interface UploadedMediaResult {
  id?: string;
  name?: string;
  fullPath?: string;
  raw: unknown;
}

export interface MediaItemResult {
  itemId: string;
  name: string;
  path: string;
  /** Public URL when resolved via Experience Edge GraphQL (`item.url.url`) or authoring when usable. */
  previewUrl?: string;
}

function getExperienceEdgeGraphqlConfig(): { endpoint: string; apiKey: string } | null {
  if (typeof process === "undefined") return null;
  const apiKey = process.env.NEXT_PUBLIC_EXPERIENCE_EDGE_TOKEN?.trim()
  if (!apiKey) return null;
  const endpoint =
    process.env.NEXT_PUBLIC_SITECORE_EDGE_GRAPHQL_URL?.trim() ||
    "https://edge.sitecorecloud.io/api/graphql/v1";
  return { endpoint, apiKey };
}

function getEdgeDefaultLanguage(): string {
  return "en";
}

function buildExperienceEdgeGraphqlHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    sc_apikey: apiKey,
  };
}

function extractEdgeItemPublicUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const errors = root.errors;
  if (Array.isArray(errors) && errors.length > 0) return undefined;
  const data = root.data;
  if (!data || typeof data !== "object") return undefined;
  const item = (data as Record<string, unknown>).item;
  if (!item || typeof item !== "object") return undefined;
  const urlField = (item as Record<string, unknown>).url;
  if (!urlField || typeof urlField !== "object") return undefined;
  const url = (urlField as Record<string, unknown>).url;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

/**
 * Calls Experience Edge GraphQL (same as `curl …/api/graphql/v1` + `sc_apikey`) to get the public link field `url.url` for a media item path.
 * Uses `NEXT_PUBLIC_EXPERIENCE_EDGE_TOKEN` (or `NEXT_PUBLIC_EXPERIENCE_EDGE` / `NEXT_PUBLIC_SITECORE_EDGE_API_KEY`) as header `sc_apikey`, plus optional `NEXT_PUBLIC_SITECORE_EDGE_GRAPHQL_URL`.
 */
export async function fetchEdgePublicUrlByItemPath(params: {
  path: string;
  language?: string;
}): Promise<string | undefined> {
  const config = getExperienceEdgeGraphqlConfig();
  if (!config || !params.path.trim()) return undefined;

  const language = params.language?.trim() || getEdgeDefaultLanguage();

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: buildExperienceEdgeGraphqlHeaders(config.apiKey),
      body: JSON.stringify({
        query: edgeMediaItemUrlQuery,
        variables: { path: params.path.trim(), language },
      }),
    });

    if (!response.ok) return undefined;
    const json = (await response.json().catch(() => null)) as unknown;
    const url = extractEdgeItemPublicUrl(json);
    if (url && /^https?:\/\//i.test(url)) return url;
    return undefined;
  } catch {
    return undefined;
  }
}

function mapEdgeMediaChildRow(row: Record<string, unknown>): MediaItemResult {
  const urlField = row.url && typeof row.url === "object" ? (row.url as Record<string, unknown>) : undefined;
  const urlNested = urlField?.url;
  const previewUrl =
    typeof urlNested === "string" && /^https?:\/\//i.test(urlNested) ? urlNested : undefined;
  const id = row.id ?? row.itemId;
  return {
    itemId: String(id ?? ""),
    name: String(row.name ?? ""),
    path: String(row.path ?? ""),
    previewUrl,
  };
}

/**
 * Lists direct children of a media folder via Experience Edge (`children.results` + `url.url`).
 */
export async function listMediaLibraryItemsFromEdge(params: {
  folderPath: string;
  language?: string;
}): Promise<MediaItemResult[]> {
  const config = getExperienceEdgeGraphqlConfig();
  if (!config || !params.folderPath.trim()) return [];

  const language = params.language?.trim() || getEdgeDefaultLanguage();

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: buildExperienceEdgeGraphqlHeaders(config.apiKey),
      body: JSON.stringify({
        query: edgeListMediaChildrenQuery,
        variables: { path: params.folderPath.trim(), language },
      }),
    });

    if (!response.ok) return [];
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || typeof json !== "object") return [];
    const errors = json.errors;
    if (Array.isArray(errors) && errors.length > 0) return [];

    const data = json.data;
    if (!data || typeof data !== "object") return [];
    const item = (data as Record<string, unknown>).item;
    if (!item || typeof item !== "object") return [];
    const children = (item as Record<string, unknown>).children;
    if (!children || typeof children !== "object") return [];
    const results = (children as Record<string, unknown>).results;
    const list = Array.isArray(results) ? results : [];

    return list
      .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
      .map((r) => mapEdgeMediaChildRow(r))
      .filter((r) => r.itemId.length > 0);
  } catch {
    return [];
  }
}

async function enrichMediaItemsWithEdgePublicUrl(items: MediaItemResult[]): Promise<MediaItemResult[]> {
  const config = getExperienceEdgeGraphqlConfig();
  if (!config || items.length === 0) return items;

  const language = getEdgeDefaultLanguage();

  const batchSize = 8;
  const out: MediaItemResult[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const batch = await Promise.all(
      slice.map(async (item) => {
        const edgeUrl = await fetchEdgePublicUrlByItemPath({ path: item.path, language });
        if (edgeUrl && /^https?:\/\//i.test(edgeUrl)) {
          return { ...item, previewUrl: edgeUrl };
        }
        return item;
      }),
    );
    out.push(...batch);
  }
  return out;
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

function extractPresignedUploadUrl(response: unknown): string | undefined {
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
  const uploadMedia =
    source?.uploadMedia && typeof source.uploadMedia === "object"
      ? (source.uploadMedia as Record<string, unknown>)
      : undefined;
  const url = uploadMedia?.presignedUploadUrl;

  return typeof url === "string" && url.length > 0 ? url : undefined;
}

function normalizeUploadMediaItemPath(itemPath: string): string {
  const normalizedPath = itemPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const lowerPath = normalizedPath.toLowerCase();
  const mediaLibraryPrefix = SITECORE_MEDIA_LIBRARY_PREFIX.replace(/^\/+/, "");

  if (lowerPath.startsWith(mediaLibraryPrefix)) {
    return normalizedPath.slice(mediaLibraryPrefix.length);
  }

  return normalizedPath;
}

export async function uploadImageToMediaLibrary(
  client: ClientSDK,
  params: { itemPath: string; file: File | Blob; fileName: string },
): Promise<UploadedMediaResult> {
  const itemPath = "Project/sai-sitecore/sai-sitecore/test.jpg";
  const mutationResponse = await executeAuthoringGraphql(client, {
    query: requestUploadUrlMutation,
    variables: {itemPath},
  });
  const presignedUploadUrl = extractPresignedUploadUrl(mutationResponse);

  if (!presignedUploadUrl) {
    throw new Error("Failed to get pre-signed upload URL from Sitecore.");
  }

  const formData = new FormData();
  formData.append("", params.file, params.fileName);

  const uploadResponse = await fetch(presignedUploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const reason = await uploadResponse.text();
    throw new Error(`Media upload failed (${uploadResponse.status}): ${reason}`);
  }

  const raw = (await uploadResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    name: typeof raw.name === "string" ? raw.name : undefined,
    fullPath: typeof raw.fullPath === "string" ? raw.fullPath : undefined,
    raw,
  };
}

export async function getMediaItemById(
  client: ClientSDK,
  itemId: string,
): Promise<MediaItemResult | null> {
  const response = await executeAuthoringGraphql(client, {
    query: getMediaItemQuery,
    variables: { itemId },
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

  const urlRaw = item.url;
  const previewUrl =
    typeof urlRaw === "string" && urlRaw.length > 0 ? urlRaw : undefined;

  const row: MediaItemResult = {
    itemId: String(item.itemId ?? ""),
    name: String(item.name ?? ""),
    path: String(item.path ?? ""),
    previewUrl,
  };
  const enriched = await enrichMediaItemsWithEdgePublicUrl([row]);
  return enriched[0] ?? null;
}

/**
 * Lists media folder children. When Edge is configured (`sc_apikey` via env) and a folder path is provided
 * (`edgeFolderPath` or `NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_EDGE_FOLDER_PATH`), uses Experience Edge
 * `ListMediaUrls` so each row includes public `previewUrl` (`url.url`). Otherwise falls back to authoring GraphQL + per-item Edge URL enrichment.
 */
export async function listMediaLibraryItems(
  client: ClientSDK,
  folderId: string,
  first = 50,
  edgeFolderPath?: string,
): Promise<MediaItemResult[]> {
  const resolvedEdgePath =
    (edgeFolderPath?.trim() ||
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_EDGE_FOLDER_PATH?.trim()
        : "")) || undefined;

  if (resolvedEdgePath && getExperienceEdgeGraphqlConfig()) {
    const fromEdge = await listMediaLibraryItemsFromEdge({
      folderPath: resolvedEdgePath,
      language: getEdgeDefaultLanguage(),
    });
    if (fromEdge.length > 0) {
      return fromEdge.slice(0, first);
    }
  }

  const response = await executeAuthoringGraphql(client, {
    query: listMediaItemsQuery,
    variables: { folderId, first },
  });

  if (!response || typeof response !== "object") return [];

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
  const children =
    item?.children && typeof item.children === "object"
      ? (item.children as Record<string, unknown>)
      : undefined;
  const nodes = Array.isArray(children?.nodes) ? (children.nodes as unknown[]) : [];

  const mapped = nodes
    .filter((node): node is Record<string, unknown> => Boolean(node && typeof node === "object"))
    .map((node) => {
      const urlRaw = node.url;
      const previewUrl =
        typeof urlRaw === "string" && urlRaw.length > 0 ? urlRaw : undefined;
      return {
        itemId: String(node.itemId ?? ""),
        name: String(node.name ?? ""),
        path: String(node.path ?? ""),
        previewUrl,
      };
    })
    .filter((node) => node.itemId.length > 0);

  return enrichMediaItemsWithEdgePublicUrl(mapped);
}
