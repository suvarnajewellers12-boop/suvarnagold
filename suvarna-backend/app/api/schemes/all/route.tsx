import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= GET ALL SCHEMES =================
export async function GET(req: Request) {
  try {
    // 🔐 Authorization
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid Token" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    // 🔐 Allow only SuperAdmin (you can expand later)
    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 Fetch Schemes with Customers
    const schemes = await prisma.scheme.findMany({
      include: {
        customers: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                username: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return new NextResponse(
      JSON.stringify({ schemes }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Fetch schemes error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}