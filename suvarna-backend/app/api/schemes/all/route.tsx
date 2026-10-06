import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };
}

// ============================================================
// PREFLIGHT
// ============================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ============================================================
// GET ALL SCHEMES
// ============================================================

export async function GET(req: Request) {
  try {
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

            coupon: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return new NextResponse(
      JSON.stringify({
        schemes,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Fetch schemes error:",
      error
    );

    return new NextResponse(
      JSON.stringify({
        error: "Internal Server Error",
      }),
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}