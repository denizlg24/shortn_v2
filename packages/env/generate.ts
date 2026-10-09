import { envExample } from "./index";
await Bun.write(new URL("../../.env.example", import.meta.url), envExample());
console.log("Generated root .env.example from app schemas");
