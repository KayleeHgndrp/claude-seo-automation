/**
 * SSRF protection — TypeScript port of scripts/url_safety.py from the
 * claude-seo repo. Every code path that fetches a user-supplied URL
 * (Firecrawl render, any direct fetch) MUST validate through here first.
 *
 * Two layers, matching the Python module:
 *   - validateUrl()        : synchronous, no DNS. Rejects bad schemes,
 *                            blocked hostnames, and IP literals in
 *                            private/loopback/reserved ranges (incl.
 *                            obfuscated IPv4 forms).
 *   - assertUrlSafe()      : async. Resolves the hostname and checks EVERY
 *                            returned A/AAAA record, defeating DNS rebinding.
 *
 * Node's `fetch`/Firecrawl perform their own DNS resolution, so as in the
 * Python notes for Playwright we cannot fully DNS-pin at this layer; we run
 * assertUrlSafe() as a strict pre-flight and re-check on redirects.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

export class URLSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "URLSafetyError";
  }
}

// Hard-blocked hostnames. Refused before any DNS resolution. Mirrors
// _BLOCKED_HOSTNAMES in url_safety.py (cloud metadata + loopback).
const BLOCKED_HOSTNAMES = new Set<string>([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "metadata.azure.com",
  "metadata.ec2.internal",
  "metadata.oraclecloud.com",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS/Azure/GCP/Oracle/Alibaba metadata IPv4
  "fd00:ec2::254", // AWS IMDS IPv6
]);

// Matches glibc/inet_aton-friendly numeric IPv4 obfuscations (dotted-quad,
// octal, hex, integer forms). Anything matching is normalized before policy.
const IPV4_OBFUSCATED_RE = /^(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+)){0,3}$/i;

/** Normalize an obfuscated IPv4 literal to canonical dotted-quad, else null. */
function canonicalizeIpv4(host: string): string | null {
  if (!IPV4_OBFUSCATED_RE.test(host)) return null;
  const parts = host.split(".");
  const nums: number[] = [];
  for (const p of parts) {
    let n: number;
    if (/^0x/i.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  // Collapse short forms (a, a.b, a.b.c) the way inet_aton does.
  let value: number;
  switch (nums.length) {
    case 1:
      value = nums[0] >>> 0;
      break;
    case 2:
      if (nums[0] > 0xff || nums[1] > 0xffffff) return null;
      value = ((nums[0] << 24) | nums[1]) >>> 0;
      break;
    case 3:
      if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) return null;
      value = ((nums[0] << 24) | (nums[1] << 16) | nums[2]) >>> 0;
      break;
    case 4:
      if (nums.some((n) => n > 0xff)) return null;
      value = ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
      break;
    default:
      return null;
  }
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".");
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function inRange(ipInt: number, cidr: [string, number]): boolean {
  const [base, bits] = cidr;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(base) & mask);
}

// IPv4 ranges that are never safe to fetch.
const UNSAFE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

/** True iff the address is a public unicast IP. Mirrors is_safe_ip(). */
export function isSafeIp(ipStr: string): boolean {
  if (net.isIPv4(ipStr)) {
    const n = ipv4ToInt(ipStr);
    return !UNSAFE_V4_RANGES.some((r) => inRange(n, r));
  }
  if (net.isIPv6(ipStr)) {
    const ip = ipStr.toLowerCase();
    // Handle IPv4-mapped (::ffff:a.b.c.d) by extracting the v4 tail.
    const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isSafeIp(mapped[1]);
    if (ip === "::" || ip === "::1") return false; // unspecified / loopback
    if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return false; // link-local fe80::/10
    if (ip.startsWith("fc") || ip.startsWith("fd")) return false; // unique-local fc00::/7
    if (ip.startsWith("ff")) return false; // multicast
    return true;
  }
  return false;
}

/**
 * Synchronous validation (no DNS). Returns the parsed URL on success.
 * Throws URLSafetyError otherwise. Mirrors validate_url() semantics.
 */
export function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new URLSafetyError(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new URLSafetyError(`Only http/https URLs are allowed (got ${parsed.protocol}).`);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new URLSafetyError("URL has no hostname.");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new URLSafetyError(`Hostname is blocked: ${host}`);
  }

  // IP literal? Validate the range directly (no DNS needed).
  const canonical = canonicalizeIpv4(host);
  const candidateIp = canonical ?? (net.isIP(host) ? host : null);
  if (candidateIp) {
    if (!isSafeIp(candidateIp)) {
      throw new URLSafetyError(`IP literal is in a private/reserved range: ${host}`);
    }
  }

  return parsed;
}

/**
 * Strict async validation: resolve the hostname and reject if ANY resolved
 * address is non-public. Defeats DNS rebinding. Call this immediately before
 * issuing a network request to the URL. Mirrors validate_url_strict().
 */
export async function assertUrlSafe(rawUrl: string): Promise<URL> {
  const parsed = validateUrl(rawUrl);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // If host is an IP literal, validateUrl already checked it.
  if (net.isIP(host) || canonicalizeIpv4(host)) return parsed;

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new URLSafetyError(`DNS resolution failed for ${host}.`);
  }
  if (records.length === 0) {
    throw new URLSafetyError(`No DNS records for ${host}.`);
  }
  for (const { address } of records) {
    if (!isSafeIp(address)) {
      throw new URLSafetyError(
        `Hostname ${host} resolves to a private/reserved address (${address}).`,
      );
    }
  }
  return parsed;
}
