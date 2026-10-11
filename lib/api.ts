// Calls the Go API (stickynotes-backend). Server-side only: tokens never reach browser JS.
const API_URL = process.env.API_URL || "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** `userAgent` passes the browser's on at sign-in, so Settings can name the device. */
export async function api<T>(path: string, opts: { method?: string; token?: string; body?: unknown; userAgent?: string | null } = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.userAgent ? { "User-Agent": opts.userAgent } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? "", err.error ?? `API ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
