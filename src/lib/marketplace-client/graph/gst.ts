"use client";

import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { asMarketplaceSdkClient } from "@/src/lib/marketplace-client/client";
import { resolveSitecoreContextId } from "@/src/lib/marketplace-client/context";

const gstConfigurationQuery = `
  query GstConfiguration($itemId: ID!, $language: String!, $fieldName: String!) {
    item(where: { database: "master", itemId: $itemId, language: $language }) {
      itemId
      gst: field(name: $fieldName) {
        value
      }
    }
  }
`;

const updateGstConfigurationMutation = `
  mutation UpdateGstConfiguration($itemId: ID!, $language: String!, $fieldName: String!, $value: String!) {
    updateItem(
      input: {
        database: "master"
        itemId: $itemId
        language: $language
        fields: [{ name: $fieldName, value: $value, reset: false }]
      }
    ) {
      item {
        itemId
        gst: field(name: $fieldName) {
          value
        }
      }
    }
  }
`;

function getGstSitecoreConfig() {
  const itemId = "1228fff49102492c8857a0537170a275";
  const fieldName = "GST";
  const language = "en";

  return { itemId, fieldName, language };
}

async function executeAuthoringGraphql(
  client: ClientSDK,
  body: Record<string, unknown>,
  mode: "query" | "mutate" = "query",
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

  const initialResponse =
    mode === "mutate" && queryClient.mutate
      ? await queryClient.mutate("xmc.authoring.graphql", payload)
      : await queryClient.query("xmc.authoring.graphql", payload);
  const queryState =
    initialResponse && typeof initialResponse === "object"
      ? (initialResponse as Record<string, unknown>)
      : undefined;
  const shouldRefetch = typeof queryState?.refetch === "function" && queryState.data === undefined;

  return shouldRefetch ? await (queryState.refetch as () => Promise<unknown>)() : initialResponse;
}

function extractGstValueFromItem(item: unknown): number {
  if (!item || typeof item !== "object") return 0;

  const itemRecord = item as Record<string, unknown>;
  const gstField =
    itemRecord.gst && typeof itemRecord.gst === "object"
      ? (itemRecord.gst as Record<string, unknown>)
      : undefined;
  const value = typeof gstField?.value === "string" ? gstField.value.trim() : "";
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveGstItem(response: unknown): Record<string, unknown> | undefined {
  const visited = new Set<unknown>();

  function walk(node: unknown): Record<string, unknown> | undefined {
    if (!node || typeof node !== "object" || visited.has(node)) {
      return undefined;
    }

    visited.add(node);

    const record = node as Record<string, unknown>;
    if (record.gst && typeof record.gst === "object") {
      const gstRecord = record.gst as Record<string, unknown>;
      if (typeof gstRecord.value === "string") {
        return record;
      }
    }

    if (record.item && typeof record.item === "object") {
      const foundInItem = walk(record.item);
      if (foundInItem) {
        return foundInItem;
      }
    }

    if (record.updateItem && typeof record.updateItem === "object") {
      const foundInUpdate = walk(record.updateItem);
      if (foundInUpdate) {
        return foundInUpdate;
      }
    }

    if (record.data && typeof record.data === "object") {
      const foundInData = walk(record.data);
      if (foundInData) {
        return foundInData;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        const found = walk(value);
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  return walk(response);
}

export async function fetchGstConfiguration(client: ClientSDK): Promise<number> {
  const { itemId, fieldName, language } = getGstSitecoreConfig();
  const response = await executeAuthoringGraphql(client, {
    query: gstConfigurationQuery,
    variables: { itemId, fieldName, language },
  });

  return extractGstValueFromItem(resolveGstItem(response));
}

export async function updateGstConfigurationInGraph(client: ClientSDK, value: number): Promise<number> {
  const { itemId, fieldName, language } = getGstSitecoreConfig();
  const response = await executeAuthoringGraphql(
    client,
    {
      query: updateGstConfigurationMutation,
      variables: {
        itemId,
        fieldName,
        language,
        value: String(value),
      },
    },
    "mutate",
  );

  return extractGstValueFromItem(resolveGstItem(response));
}
