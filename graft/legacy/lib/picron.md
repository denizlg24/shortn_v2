# legacy/lib/picron.ts

- request · function · L6-L11 — function request(path: string, init: RequestInit): Promise<Response>
- login · function · L13-L33 — async function login(): Promise<string>
- getToken · function · L35-L38 — async function getToken(): Promise<string>
- authFetch · function · L40-L62 — async function authFetch( path: string, init: RequestInit, retry = true, ): Promise<Response>
- CreateScheduleOptions · interface · L64-L71 — interface CreateScheduleOptions
- ScheduleResponse · interface · L73-L83 — interface ScheduleResponse
- createSchedule · function · L85-L112 — async function createSchedule( options: CreateScheduleOptions, ): Promise<ScheduleResponse>
- deleteSchedule · function · L114-L126 — async function deleteSchedule(id: string): Promise<void>
