import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { asMarketplaceSdkClient } from "@/src/lib/marketplace-client/client";
import { resolveSitecoreContextId } from "@/src/lib/marketplace-client/context";
import {
  enrichMediaItemsWithEdgePublicUrl,
  getEdgeDefaultLanguage,
  getExperienceEdgeGraphqlConfig,
  listMediaLibraryItemsFromEdge,
} from "@/src/lib/marketplace-client/edge";

const requestUploadUrlMutation = `
  mutation RequestUploadUrl($itemPath: String!) {
    uploadMedia(input: { itemPath: $itemPath }) {
      presignedUploadUrl
    }
  }
`;

const publishMediaItemMutation = `
  mutation PublishMediaItem($itemId: ID!) {
    publishItem(input: {
      sourceDatabase: "master",
      targetDatabases: ["experienceedge"],
      rootItemIds: [$itemId],
      publishSubItems: false,
      publishRelatedItems: false,
      publishItemMode: SMART,
      languages: ["en"]
    }) {
      operationId
    }
  }
`;

const getMediaItemQuery = `
  query GetMediaItem($itemId: ID!) {
    item(where: { database: "master", itemId: $itemId }) {
      itemId
      name
      path
      url
    }
  }
`;

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

export interface UploadedMediaResult {
  id?: string;
  name?: string;
  fullPath?: string;
  publishOperationId?: string;
  raw: unknown;
}

export interface MediaItemResult {
  itemId: string;
  name: string;
  path: string;
  previewUrl?: string;
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

function extractUploadedMediaField(response: unknown, fieldName: string): string | undefined {
  if (!response || typeof response !== "object") return undefined;

  const root = response as Record<string, unknown>;
  const candidates: Array<Record<string, unknown> | undefined> = [
    root,
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : undefined,
    root.data && typeof root.data === "object"
      ? (((root.data as Record<string, unknown>).data as Record<string, unknown> | undefined) ?? undefined)
      : undefined,
  ];

  for (const candidate of candidates) {
    const value = candidate?.[fieldName];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
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

async function getMediaUploadHeaders(): Promise<HeadersInit | undefined> {
  const response = await fetch("/api/sitecore/auth-token", {
    method: "POST",
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Unable to fetch Sitecore auth token.");
  }

  const token = typeof data.access_token === "string" ? data.access_token.trim() : "";
  if (!token) {
    throw new Error("Sitecore auth token response did not include an access token.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function sanitizeSitecoreItemName(value: string): string {
  // 1. Remove the file extension first (e.g., "photo.png" -> "photo")
  const nameWithoutExtension = value.split('.').slice(0, -1).join('.');

  const sanitized = nameWithoutExtension
    .trim()
    .replace(/[\\/:?"<>|\[\]]+/g, "-") // Replace invalid chars with hyphen
    .replace(/\s+/g, "-")             // Replace spaces with hyphen (standard practice)
    .replace(/-+/g, "-")              // Collapse multiple hyphens
    .replace(/^[.\- ]+|[.\- ]+$/g, ""); // Trim hyphens/dots from start/end

  return sanitized || "uploaded-file";
}

export async function uploadImageToMediaLibrary(
  client: ClientSDK,
  params: { file: File | Blob; fileName: string },
): Promise<UploadedMediaResult> {
  const fileNameFormat = sanitizeSitecoreItemName(params.fileName);
  const itemPath = `Project/sai-sitecore/sai-sitecore/${fileNameFormat}`;
  const mutationResponse = await executeAuthoringGraphql(client, {
    query: requestUploadUrlMutation,
    variables: { itemPath },
  });
  const presignedUploadUrl = extractPresignedUploadUrl(mutationResponse);

  if (!presignedUploadUrl) {
    throw new Error("Failed to get pre-signed upload URL from Sitecore.");
  }

  const formData = new FormData();
  formData.append("file", params.file, params.fileName);
  const uploadHeaders = await getMediaUploadHeaders();

  const uploadResponse = await fetch(`${presignedUploadUrl}&sc_apikey={4123E90E-698F-4C90-B250-4FD44D51C756}`, {
    method: "POST",
    headers: uploadHeaders,
    body: formData,
  });

  if (!uploadResponse.ok) {
    const reason = await uploadResponse.text();
    throw new Error(`Media upload failed (${uploadResponse.status}): ${reason}`);
  }

  const raw = (await uploadResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const uploadedId = typeof raw.Id === "string" ? raw.Id : undefined;
  const uploadedName = typeof raw.Name === "string" ? raw.Name : undefined;
  const uploadedFullPath = typeof raw.ItemPath === "string" ? raw.ItemPath : undefined;

  let publishOperationId: string | undefined;
  if (uploadedId) {
    const publishResponse = await executeAuthoringGraphql(client, {
      query: publishMediaItemMutation,
      variables: { itemId: uploadedId },
    });
    publishOperationId = extractPublishOperationId(publishResponse);

    if (!publishOperationId) {
      throw new Error("Media uploaded but publish to Edge did not return an operationId.");
    }
  }

  return {
    id: uploadedId,
    name: uploadedName,
    fullPath: uploadedFullPath,
    publishOperationId,
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

export async function listMediaLibraryItems(
  client: ClientSDK,
  folderId: string,
  first = 50,
  edgeFolderPath?: string,
): Promise<MediaItemResult[]> {
  const resolvedEdgePath = edgeFolderPath?.trim();

  if (resolvedEdgePath && getExperienceEdgeGraphqlConfig()) {
    const fromEdge = await listMediaLibraryItemsFromEdge({
      folderPath: resolvedEdgePath,
      language: getEdgeDefaultLanguage(),
      first,
    });
    if (fromEdge.length > 0) {
      return fromEdge;
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
