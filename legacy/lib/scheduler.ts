import env from "@/utils/env";

let cachedToken: string | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${env.SCHEDULER_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.SCHEDULER_USERNAME,
      password: env.SCHEDULER_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error(`Scheduler login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  return cachedToken!;
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
  const res = await fetch(`${env.SCHEDULER_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401 && retry) {
    cachedToken = null;
    return authFetch(path, init, false);
  }

  return res;
}

interface CreateScheduleOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  run_at: string;
}

interface ScheduleResponse {
  id: string;
}

export async function createSchedule(
  options: CreateScheduleOptions,
): Promise<ScheduleResponse> {
  const res = await authFetch("/api/schedules", {
    method: "POST",
    body: JSON.stringify({
      url: options.url,
      method: options.method || "POST",
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      run_at: options.run_at,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create schedule: ${res.status} ${text}`);
  }

  return res.json();
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await authFetch(`/api/schedules/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete schedule: ${res.status} ${text}`);
  }
}
