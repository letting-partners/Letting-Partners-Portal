const WEBSITE_API_BASE = "/api/website";

function buildWebsiteApiUrl(path: string) {
  return `${WEBSITE_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export type WebsiteApiEnvelope = {
  error?: string;
  ok?: boolean;
};

export async function getWebsiteApiJson<T>(path: string, signal?: AbortSignal) {
  const response = await fetch(buildWebsiteApiUrl(path), {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (payload && typeof payload === "object") return payload as T;
    throw new Error(`API request failed with status ${response.status}.`);
  }

  return payload as T;
}
