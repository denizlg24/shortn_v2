import { afterEach, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function newClient() {
  // Each test gets a fresh token cache without exposing a reset hook in the app.
  return (await import(
    `../lib/picron.ts?test=${randomUUID()}`
  )) as typeof import("../lib/picron");
}

test("PiCron login, schedule and cancellation use the documented shapes and cache tokens", async () => {
  const client = await newClient();
  const schedule = {
    id: "schedule-1",
    url: "https://shortn.test/api/polar/execute-downgrade",
    method: "POST",
    timeout: 30,
    run_at: "2026-10-10T10:30:00.000Z",
    status: "pending" as const,
    http_status: 0,
    duration_ms: 0,
    created_at: "2026-10-09T10:30:00Z",
  };
  const fetchSpy = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ token: "test-token" }))
    .mockResolvedValueOnce(Response.json(schedule, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ status: "cancelled" }));
  const body = JSON.stringify({
    subscriptionId: "subscription",
    newProductId: "basic",
  });
  expect(
    await client.createSchedule({
      url: schedule.url,
      method: "POST",
      headers: { Authorization: "Bearer internal-test-secret" },
      body,
      run_at: "2026-10-10T12:30:00+02:00",
    }),
  ).toEqual(schedule);
  await client.deleteSchedule("schedule-1");

  expect(fetchSpy).toHaveBeenCalledTimes(3);
  const [loginUrl, loginInit] = fetchSpy.mock.calls[0];
  expect(loginUrl).toBe("https://picron.test/api/login");
  expect(loginInit?.method).toBe("POST");
  expect(JSON.parse(loginInit!.body as string)).toEqual({
    username: "test-user",
    password: "test-password",
  });
  const [url, init] = fetchSpy.mock.calls[1];
  expect(url).toBe("https://picron.test/api/schedules");
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  });
  expect(JSON.parse(init!.body as string)).toEqual({
    url: schedule.url,
    method: "POST",
    headers: { Authorization: "Bearer internal-test-secret" },
    body,
    timeout: 30,
    run_at: schedule.run_at,
  });
  expect(fetchSpy.mock.calls[2][0]).toBe(
    "https://picron.test/api/schedules/schedule-1",
  );
  expect(fetchSpy.mock.calls[2][1]?.method).toBe("DELETE");
  for (const [, request] of fetchSpy.mock.calls)
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  fetchSpy.mockRestore();
});

test("401 logs in once more and retries the same schedule with a new token", async () => {
  const client = await newClient();
  const fetchSpy = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ token: "expired-token" }))
    .mockResolvedValueOnce(
      Response.json({ error: "unauthorized" }, { status: 401 }),
    )
    .mockResolvedValueOnce(Response.json({ token: "fresh-token" }))
    .mockResolvedValueOnce(
      Response.json({ id: "retried-schedule" }, { status: 201 }),
    );
  const options = {
    url: "https://shortn.test/api/polar/execute-downgrade",
    run_at: "2026-10-10T10:00:00Z",
  };
  expect((await client.createSchedule(options)).id).toBe("retried-schedule");
  expect(fetchSpy).toHaveBeenCalledTimes(4);
  expect(fetchSpy.mock.calls[2][0]).toBe("https://picron.test/api/login");
  expect(fetchSpy.mock.calls[1][1]?.body).toBe(fetchSpy.mock.calls[3][1]?.body);
  expect(fetchSpy.mock.calls[3][1]?.headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer fresh-token",
  });
  expect(JSON.parse(fetchSpy.mock.calls[3][1]!.body as string).method).toBe(
    "GET",
  );
  fetchSpy.mockRestore();
});

test("a second 401 stops retries and service errors never echo tokens", async () => {
  const client = await newClient();
  const fetchSpy = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ token: "expired-token" }))
    .mockResolvedValueOnce(
      Response.json({ error: "expired-token" }, { status: 401 }),
    )
    .mockResolvedValueOnce(Response.json({ token: "fresh-token" }))
    .mockResolvedValueOnce(
      Response.json({ error: "fresh-token" }, { status: 401 }),
    );
  await expect(client.deleteSchedule("schedule/1")).rejects.toThrow(
    "Failed to delete PiCron schedule: 401",
  );
  expect(fetchSpy).toHaveBeenCalledTimes(4);
  expect(fetchSpy.mock.calls[1][0]).toBe(
    "https://picron.test/api/schedules/schedule%2F1",
  );
  fetchSpy.mockRestore();
});

test("login failures do not echo credentials", async () => {
  const client = await newClient();
  const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "test-password" }, { status: 401 }),
  );
  await expect(client.deleteSchedule("schedule-1")).rejects.toThrow(
    "PiCron login failed: 401",
  );
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  fetchSpy.mockRestore();
});

test("login and authenticated requests each have a ten-second timeout", async () => {
  const client = await newClient();
  const timeoutSpy = spyOn(AbortSignal, "timeout");
  const fetchSpy = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ token: "test-token" }))
    .mockResolvedValueOnce(Response.json({ status: "cancelled" }));
  await client.deleteSchedule("schedule-1");
  expect(timeoutSpy.mock.calls).toEqual([[10_000], [10_000]]);
  timeoutSpy.mockRestore();
  fetchSpy.mockRestore();
});
