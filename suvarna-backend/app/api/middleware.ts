import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const origin = req.headers.get("origin") || "";

  // Allow all localhost ports (dev mode)
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8080/",
    
  ];

  const isAllowed = allowedOrigins.includes(origin);

  // ========================
  // CORS Preflight
  // ========================
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ========================
  // Public Auth Routes
  // ========================
  if (pathname.startsWith("/api/auth")) {
    return response;
  }

  // ========================
  // Token Required Below
  // ========================
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  let decoded: any;

  try {
    decoded = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // ========================
  // ROLE CONTROL
  // ========================

  if (pathname.startsWith("/api/admins")) {
    if (decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/products/create")) {
    if (decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/products/sell")) {
    if (decoded.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/products/scan")) {
    if (decoded.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
