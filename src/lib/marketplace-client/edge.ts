export interface EdgeMediaItemResult {
  itemId: string;
  name: string;
  path: string;
  previewUrl?: string;
}

const edgeMediaItemUrlQuery = `
  query EdgeMediaItemUrl($path: String!, $language: String!) {
    item(path: $path, language: $language) {
      url {
        url
      }
    }
  }
`;

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

export function getExperienceEdgeGraphqlConfig(): { endpoint: string; apiKey: string } | null {
  if (typeof process === "undefined") return null;
  const apiKey = process.env.NEXT_PUBLIC_EXPERIENCE_EDGE_TOKEN?.trim();
  if (!apiKey) return null;
  const endpoint =
    process.env.NEXT_PUBLIC_SITECORE_EDGE_GRAPHQL_URL?.trim() ||
    "https://edge.sitecorecloud.io/api/graphql/v1";
  return { endpoint, apiKey };
}

export function getEdgeDefaultLanguage(): string {
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

function mapEdgeMediaChildRow(row: Record<string, unknown>): EdgeMediaItemResult {
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

export async function listMediaLibraryItemsFromEdge(params: {
  folderPath: string;
  language?: string;
}): Promise<EdgeMediaItemResult[]> {
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

export async function enrichMediaItemsWithEdgePublicUrl<T extends EdgeMediaItemResult>(
  items: T[],
): Promise<T[]> {
  const config = getExperienceEdgeGraphqlConfig();
  if (!config || items.length === 0) return items;

  const language = getEdgeDefaultLanguage();

  const batchSize = 8;
  const out: T[] = [];
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
