import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedOrigin = "http://localhost:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 🔥 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const products = await prisma.product.findMany({
      where: {
        isSold: false,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { id: { contains: query, mode: "insensitive" } },
          isNaN(Number(query))
            ? undefined
            : { grams: Number(query) },
        ].filter(Boolean),
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { products },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Search error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
