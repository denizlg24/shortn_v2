import { polarClient } from "@polar-sh/better-auth";
import {
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "./index";

export const authClient = createAuthClient({
  plugins: [usernameClient(), polarClient(), inferAdditionalFields<Auth>()],
});
