const blockedHosts = new Set(["localhost"]);
const blockedIpv4Literals = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^255\./
];
const blockedIpv6Literals = ["::1", "fc00::", "fd00::", "fe80::"];

function isIpv4Literal(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isBlockedIpv4(hostname: string) {
  if (!isIpv4Literal(hostname)) {
    return false;
  }

  if (hostname === "169.254.169.254") {
    return true;
  }

  const octets = hostname.split(".").map((segment) => Number(segment));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
    return true;
  }

  return blockedIpv4Literals.some((pattern) => pattern.test(hostname));
}

function isBlockedIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (!normalized.includes(":")) {
    return false;
  }

  return blockedIpv6Literals.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

function isBlockedHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  if (blockedHosts.has(normalized) || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    return true;
  }

  return isBlockedIpv4(normalized) || isBlockedIpv6(normalized);
}

export function parseSafeRemoteUrl(input: string, options?: { allowHosts?: Iterable<string> }) {
  const url = new URL(input);
  const protocol = url.protocol.toLowerCase();

  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new Error("Remote URLs must not include credentials.");
  }

  if (isBlockedHost(url.hostname)) {
    throw new Error("Remote URLs must not target internal hosts.");
  }

  if (options?.allowHosts) {
    const allowedHosts = new Set(Array.from(options.allowHosts, (host) => host.toLowerCase()));
    if (!allowedHosts.has(url.hostname.toLowerCase())) {
      throw new Error("Remote host is not allowed.");
    }
  }

  return url;
}

export function isSafeRemoteUrl(input: string, options?: { allowHosts?: Iterable<string> }) {
  try {
    parseSafeRemoteUrl(input, options);
    return true;
  } catch {
    return false;
  }
}
