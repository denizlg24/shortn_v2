export interface DeviceInfo {
  browser: string | null;
  os: string | null;
  mobile: boolean;
}

// Enough to tell a user's own devices apart; order matters because most
// browsers also claim to be Chrome and Safari.
const browsers: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const systems: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

const match = (agent: string, table: [RegExp, string][]) =>
  table.find(([pattern]) => pattern.test(agent))?.[1] ?? null;

export function describeUserAgent(agent: string | null): DeviceInfo {
  if (!agent) return { browser: null, os: null, mobile: false };
  return {
    browser: match(agent, browsers),
    os: match(agent, systems),
    mobile: /Mobi|iPhone|iPad|Android/.test(agent),
  };
}
