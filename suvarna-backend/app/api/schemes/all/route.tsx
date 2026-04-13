import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= GET ALL SCHEMES (Public) =================
export async function GET(req: Request) {
  try {
    // 🔹 Fetch Schemes with Customers (No Auth Conditions)
    const schemes = await prisma.scheme.findMany({
      include: {
        enrollments: {
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
      { 
        status: 200, 
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json"
        } 
      }
    );

  } catch (error) {
    console.error("Fetch schemes error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}