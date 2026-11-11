import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Addresses that are always allowed.
const ALLOWED_IPS = new Set([
  "61.78.110.69",
  "61.78.110.80",
  "61.78.110.90",
  "116.35.186.20",
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

// TEMPORARY (opened 2026-11-11, narrow back around 2026-11-18): the hospital
// leaves through several 61.78.110.x addresses and we do not know them all.
// Requests let in only by a range are logged as [wide] so the addresses in
// real use can be collected, then this list goes back to exact addresses.
// whois shows only KT's 61.78.0.0/15 for this block, so never widen past /24.
const ALLOWED_RANGES = ["61.78.110.0/24"].map(parseIpv4Range);

interface Ipv4Range {
  base: number;
  mask: number;
}

/** Dotted-quad IPv4 to an unsigned 32-bit number; null for anything else. */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    // Plain decimal only: no leading zeros, signs or spaces.
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function parseIpv4Range(cidr: string): Ipv4Range {
  const [address, bits, extra] = cidr.split("/");
  const base = ipv4ToNumber(address);
  const prefix = Number(bits);
  if (base === null || extra !== undefined || !/^[0-9]{1,2}$/.test(bits ?? "") || prefix > 32) {
    throw new Error(`Invalid IPv4 range in allowlist: ${cidr}`);
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { base: (base & mask) >>> 0, mask };
}

function inAllowedRange(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  if (value === null) return false;
  return ALLOWED_RANGES.some((range) => ((value & range.mask) >>> 0) === range.base);
}

function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function middleware(request: NextRequest) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const timestamp = new Date().toISOString();
  const method = request.method;
  const path = request.nextUrl.pathname;
  const ua = request.headers.get("user-agent") || "-";

  console.log(`[access] ${timestamp} ${ip} ${method} ${path} "${ua}"`);

  const exactMatch = ALLOWED_IPS.has(ip);
  if (!exactMatch && !inAllowedRange(ip)) {
    console.log(`[blocked] ${timestamp} ${ip} ${method} ${path}`);
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!exactMatch) {
    console.log(`[wide] ${timestamp} ${ip} ${method} ${path}`);
  }

  // For the login and account-link pages: ensure the CSRF cookie exists and
  // forward the token via a request header so the page can use it.
  if (path === "/login" || path === "/account/setup") {
    const existingToken = request.cookies.get("csrf_token")?.value;
    const token = existingToken ?? generateCsrfToken();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-csrf-for-page", token);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (!existingToken) {
      response.cookies.set({
        name: "csrf_token",
        value: token,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
