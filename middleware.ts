import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_IPS = new Set([
  "61.78.110.80",
  "116.35.186.20",
  "127.0.0.1",
  "::1",
]);

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

  if (!ALLOWED_IPS.has(ip)) {
    console.log(`[blocked] ${timestamp} ${ip} ${method} ${path}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // For the login page: ensure CSRF cookie exists and forward the token via
  // a request header so the Server Component can embed it in the form.
  if (path === "/login") {
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
