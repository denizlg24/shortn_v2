// One file per namespace so surfaces can be edited independently.
import common from "./common.json";
import auth from "./auth.json";
import nav from "./nav.json";
import shell from "./shell.json";
import placeholder from "./placeholder.json";
import links from "./links.json";
import analytics from "./analytics.json";
import gate from "./gate.json";
import settings from "./settings.json";
import billing from "./billing.json";
import invite from "./invite.json";
import publicPages from "./public.json";
import notFound from "./notFound.json";

export default {
  common,
  auth,
  nav,
  shell,
  placeholder,
  links,
  analytics,
  gate,
  settings,
  billing,
  invite,
  public: publicPages,
  notFound,
};
