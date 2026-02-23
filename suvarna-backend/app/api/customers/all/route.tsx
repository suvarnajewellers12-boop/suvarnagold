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

// ================= GET ALL CUSTOMERS =================
export async function GET(req: Request) {
  try {
    // 🔐 AUTHORIZATION
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

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 Fetch Customers with Schemes
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        password:true,
        phone: true,
        createdAt: true,
        schemes: {
          include: {
            scheme: true, // include scheme details
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return new NextResponse(
      JSON.stringify({ customers }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Fetch customers error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}