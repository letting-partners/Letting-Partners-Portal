export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message?: string; details?: unknown };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR", message: "Network error. Please check your connection and try again." };
  }

  const json = await readJson(response);
  if (!response.ok) {
    const payload = (json ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      status: response.status,
      error: String(payload.error ?? "REQUEST_FAILED"),
      message: typeof payload.message === "string" ? payload.message : undefined,
      details: payload.details,
    };
  }

  return { ok: true, data: (json ?? {}) as T };
}

export function apiGet<T>(url: string): Promise<ApiResult<T>> {
  return request<T>(url, { method: "GET", cache: "no-store" });
}

export function apiPost<TBody extends object, TResponse>(
  url: string,
  body: TBody,
): Promise<ApiResult<TResponse>> {
  return request<TResponse>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPatch<TBody extends object, TResponse>(
  url: string,
  body: TBody,
): Promise<ApiResult<TResponse>> {
  return request<TResponse>(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<TResponse>(url: string): Promise<ApiResult<TResponse>> {
  return request<TResponse>(url, {
    method: "DELETE",
  });
}
