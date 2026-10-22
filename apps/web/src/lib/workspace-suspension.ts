// Billing (to settle a nonpayment suspension) and workspace exports (data
// portability) stay reachable while a workspace is suspended (23 §3.2).
const exempt =
  /^\/[a-z0-9][a-z0-9-]{0,62}\/settings\/(?:billing(?:\/.*)?|workspace\/(?:export|exports(?:\/[a-f\d]{24})?))\/?$/;

export const suspensionExemptPath = (pathname: string) => exempt.test(pathname);
