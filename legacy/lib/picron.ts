import env from "@/utils/env";

let cachedToken: string | null = null;
const REQUEST_TIMEOUT_MS = 10_000;

function request(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${env.PICRON_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function login(): Promise<string> {
  const res = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.PICRON_USERNAME,
      password: env.PICRON_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error(`PiCron login failed: ${res.status}`);
  }

  const data = await res.json();
  if (typeof data.token !== "string" || !data.token) {
    throw new Error("Invalid PiCron login response");
  }
  cachedToken = data.token;
  return data.token;
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  return login();
}

async function authFetch(
  path: string,
  init: RequestInit,
  retry = true,
): Promise<Response> {
  const token = await getToken();
  const res = await request(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401 && retry) {
    await res.body?.cancel();
    cachedToken = null;
    return authFetch(path, init, false);
  }

  return res;
}

interface CreateScheduleOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  run_at: string;
}

interface ScheduleResponse {
  id: string;
  url: string;
  method: string;
  timeout: number;
  run_at: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  http_status: number;
  duration_ms: number;
  created_at: string;
}

export async function createSchedule(
  options: CreateScheduleOptions,
): Promise<ScheduleResponse> {
  // Date.toISOString() emits RFC3339 in UTC, including milliseconds.
  const runAt = new Date(options.run_at).toISOString();
  const res = await authFetch("/api/schedules", {
    method: "POST",
    body: JSON.stringify({
      url: options.url,
      method: options.method ?? "GET",
      headers: options.headers || {},
      body: options.body,
      timeout: options.timeout ?? 30,
      run_at: runAt,
    }),
  });

  if (!res.ok) {
    // Do not include service response bodies: they may echo secrets or tokens.
    throw new Error(`Failed to create PiCron schedule: ${res.status}`);
  }

  const data = await res.json();
  if (typeof data.id !== "string" || !data.id) {
    throw new Error("Invalid PiCron schedule response");
  }
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await authFetch(`/api/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Failed to delete PiCron schedule: ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== "cancelled") {
    throw new Error("Invalid PiCron cancellation response");
  }
}
