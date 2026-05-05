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

function getMediaUploadHeaders(): HeadersInit | undefined {
  const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InpnbnhyQk9IaXJ0WXp4dnl1WVhNZyJ9.eyJodHRwczovL2F1dGguc2l0ZWNvcmVjbG91ZC5pby9jbGFpbXMvY2xpZW50X25hbWUiOiJxdWFuZyB0ZXN0IiwiaHR0cHM6Ly9hdXRoLnNpdGVjb3JlY2xvdWQuaW8vY2xhaW1zL3RlbmFudF9pZCI6IjMwZGZiYTQ5LThjY2QtNDY3OS05OGI4LTA4ZGU2YjAzY2UxNyIsImh0dHBzOi8vYXV0aC5zaXRlY29yZWNsb3VkLmlvL2NsYWltcy90ZW5hbnRfbmFtZSI6InNhaWRpZ2l0YWxsNzcyMC1zYWlzaXRlY29yZWZmNTEtZGV2c2l0ZWNvcmUzZTBjIiwic2Nfc3lzX2lkIjoiNTkwNzYzN2MtY2RkZi00OGU5LWFjZWYtYmQwNmYxYTZiYWI4IiwiaHR0cHM6Ly9hdXRoLnNpdGVjb3JlY2xvdWQuaW8vY2xhaW1zL3RlbmFudC9jZHBfY2xpZW50X2tleSI6ImE0OWI2ZTU0YjE0NmNlZWIwNjBkOWU0ZGY0MWQzYmYwIiwiaHR0cHM6Ly9hdXRoLnNpdGVjb3JlY2xvdWQuaW8vY2xhaW1zL3RlbmFudC9BSUVtYmVkZGVkVGVuYW50SUQiOiI3NGU0OWMzMy1iMzJhLTRjNTgtNTIzZi0wOGRlNTljMTZjMjYiLCJodHRwczovL2F1dGguc2l0ZWNvcmVjbG91ZC5pby9jbGFpbXMvdGVuYW50L0NPRW1iZWRkZWRUZW5hbnRJRCI6IjI5MDM1ZmRjLTNjNDYtNGIyNi0zYjYzLTA4ZGU1OWM1NDY5YSIsImh0dHBzOi8vYXV0aC5zaXRlY29yZWNsb3VkLmlvL2NsYWltcy90ZW5hbnQvTU1TRW1iZWRkZWRUZW5hbnRJRCI6ImI1NjMxNmJiLWMyYmUtNGFmYS01MjQwLTA4ZGU1OWMxNmMyNiIsImh0dHBzOi8vYXV0aC5zaXRlY29yZWNsb3VkLmlvL2NsYWltcy9vcmdfaWQiOiJvcmdfT0NtT2VGTHY5ODZHellFaSIsImh0dHBzOi8vYXV0aC5zaXRlY29yZWNsb3VkLmlvL2NsYWltcy9vcmdfbmFtZSI6InNhaS1kaWdpdGFsLWxpbWl0ZWQiLCJodHRwczovL2F1dGguc2l0ZWNvcmVjbG91ZC5pby9jbGFpbXMvb3JnX2Rpc3BsYXlfbmFtZSI6IlNBSSBEaWdpdGFsIExpbWl0ZWQiLCJodHRwczovL2F1dGguc2l0ZWNvcmVjbG91ZC5pby9jbGFpbXMvb3JnX2FjY291bnRfaWQiOiIwMDExTjAwMDAxdHZlOWtRQUEiLCJodHRwczovL2F1dGguc2l0ZWNvcmVjbG91ZC5pby9jbGFpbXMvb3JnX3R5cGUiOiJwYXJ0bmVyIiwic2Nfb3JnX3JlZ2lvbiI6ImpwZSIsImlzcyI6Imh0dHBzOi8vYXV0aC5zaXRlY29yZWNsb3VkLmlvLyIsInN1YiI6IkRhQ1l2VHhKQUlDdzQ3akdhR3NIZ0FOM1daZDU0M0dGQGNsaWVudHMiLCJhdWQiOiJodHRwczovL2FwaS5zaXRlY29yZWNsb3VkLmlvIiwiaWF0IjoxNzc3OTQ4NTU2LCJleHAiOjE3NzgwMzQ5NTYsInNjb3BlIjoieG1jbG91ZC5jbTphZG1pbiB4bWNwdWIucXVldWU6ciB4bWNwdWIuam9icy50OnIgeG1jcHViLmpvYnMudDp3IHhtY2RhdGEuaXRlbXMudDpyIHhtY2RhdGEucHJ2ZHMudDpyYyB4bWNkYXRhLnBydmRzLnQ6ciB4bWNkYXRhLnBydmRzLnQ6dyB4bWNkYXRhLnBydmRzLnQ6bCBwZXJzb25hbGl6ZS5leHA6bW5nIHBlcnNvbmFsaXplLnRtcGw6ciBwZXJzb25hbGl6ZS5wb3M6bW5nIGFpLm9yZy5icmk6ciBjby5icmllZnM6ciBjby5icmllZnM6dyBhaS5vcmcuYnJkOnIgYWkub3JnLmJyaTp3Iiwib3JnX2lkIjoib3JnX09DbU9lRkx2OTg2R3pZRWkiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJhenAiOiJEYUNZdlR4SkFJQ3c0N2pHYUdzSGdBTjNXWmQ1NDNHRiJ9.mq3zwNyx9eRA6Izf7iYWmphFxX1xmqH5qK822TLZBKJz07CG-MnzRV0lpiAjl_MLFX5UV8RhnFQBfcbjYEa4Pjms2Tm2OI4dy4GnhI49iTT3QAur0N-_aQvHJprbdRklbusJrn3gy6Km0V9dSFHPA-cVUrnlFfFKYo3qu5N1xZqWwKivkxRDhr-IDwkzmsMqSAyRKT3QuowEsW-qgnxH5y0HdBuij4frkPVL_Rn5jRrp9KZd0WnA5up1sw3H_z2ut_TvkBfreHWyp5KNQox8G15rjpvCixI8togZbX5P7M0HGcmhBgtHsNebC5Oafjzec4rNghcGWSEBxOWaRZj4xA";
  if (!token) return undefined;

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function uploadImageToMediaLibrary(
  client: ClientSDK,
  params: { itemPath: string; file: File | Blob; fileName: string },
): Promise<UploadedMediaResult> {
  const itemPath = "sai-sitecore/sai-sitecore";
  const mutationResponse = await executeAuthoringGraphql(client, {
    query: requestUploadUrlMutation,
    variables: { itemPath },
  });
  const presignedUploadUrl = extractPresignedUploadUrl(mutationResponse);

  if (!presignedUploadUrl) {
    throw new Error("Failed to get pre-signed upload URL from Sitecore.");
  }

  const formData = new FormData();
  formData.append("", params.file, params.fileName);

  const uploadResponse = await fetch(presignedUploadUrl, {
    method: "POST",
    headers: getMediaUploadHeaders(),
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
