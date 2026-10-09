export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(userAgent: string | undefined): ParsedUserAgent {
  if (!userAgent) {
    return {
      browser: "Unknown Browser",
      os: "Unknown OS",
      device: "Unknown Device",
    };
  }

  let browser = "Unknown Browser";
  if (userAgent.includes("Edg/")) {
    browser = "Microsoft Edge";
  } else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) {
    browser = "Google Chrome";
  } else if (userAgent.includes("Firefox/")) {
    browser = "Mozilla Firefox";
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) {
    browser = "Safari";
  } else if (userAgent.includes("Opera/") || userAgent.includes("OPR/")) {
    browser = "Opera";
  }

  let os = "Unknown OS";
  if (userAgent.includes("Windows NT 10.0")) {
    os = "Windows 10/11";
  } else if (userAgent.includes("Windows NT 6.3")) {
    os = "Windows 8.1";
  } else if (userAgent.includes("Windows NT 6.2")) {
    os = "Windows 8";
  } else if (userAgent.includes("Windows NT 6.1")) {
    os = "Windows 7";
  } else if (userAgent.includes("Mac OS X")) {
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    if (match) {
      os = `macOS ${match[1].replace(/_/g, ".")}`;
    } else {
      os = "macOS";
    }
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android ([0-9.]+)/);
    if (match) {
      os = `Android ${match[1]}`;
    } else {
      os = "Android";
    }
  } else if (
    userAgent.includes("iOS") ||
    userAgent.includes("iPhone") ||
    userAgent.includes("iPad")
  ) {
    const match = userAgent.match(/OS ([0-9_]+)/);
    if (match) {
      os = `iOS ${match[1].replace(/_/g, ".")}`;
    } else {
      os = "iOS";
    }
  }

  let device = "Desktop";
  if (userAgent.includes("Mobile") || userAgent.includes("Android")) {
    device = "Mobile";
  } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
    device = "Tablet";
  }

  return { browser, os, device };
}
