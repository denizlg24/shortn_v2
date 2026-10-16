import { createDocumentationApp } from "@shortn/docs";

const docs = createDocumentationApp({
  apiOrigin:
    process.env.PUBLIC_ORIGIN === "https://staging.shortn.at"
      ? "https://api-staging.shortn.at"
      : "https://api.shortn.at",
});
export const GET = (request: Request) => docs.fetch(request);
