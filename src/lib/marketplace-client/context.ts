interface MarketplaceQueryClient {
  application?: { context?: { sitecoreContextId?: string } };
  query: (queryKey: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

export async function resolveSitecoreContextId(
  queryClient: MarketplaceQueryClient,
): Promise<string | undefined> {
  const sdkContextId = queryClient.application?.context?.sitecoreContextId;
  if (sdkContextId) return sdkContextId;

  const contextResponse = await queryClient.query("application.context");
  if (!contextResponse || typeof contextResponse !== "object") return undefined;
  const contextObject = contextResponse as Record<string, unknown>;
  const contextData =
    contextObject.data && typeof contextObject.data === "object"
      ? (contextObject.data as Record<string, unknown>)
      : undefined;
  const context =
    contextData?.context && typeof contextData.context === "object"
      ? (contextData.context as Record<string, unknown>)
      : contextData;
  const contextId = context?.sitecoreContextId;
  if (typeof contextId === "string" && contextId.length > 0) return contextId;

  const resourceAccess = Array.isArray(context?.resourceAccess)
    ? (context.resourceAccess as unknown[])
    : undefined;
  const firstResource =
    resourceAccess && resourceAccess[0] && typeof resourceAccess[0] === "object"
      ? (resourceAccess[0] as Record<string, unknown>)
      : undefined;
  const resourceContext =
    firstResource?.context && typeof firstResource.context === "object"
      ? (firstResource.context as Record<string, unknown>)
      : undefined;
  const liveContextId = resourceContext?.live;

  return typeof liveContextId === "string" && liveContextId.length > 0 ? liveContextId : undefined;
}
