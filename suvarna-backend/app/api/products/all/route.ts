import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function GET(req: Request) {
  try {

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const products = await prisma.product.findMany({
      where: {
        isSold: false,   // ✅ ONLY UNSOLD PRODUCTS
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return new NextResponse(
      JSON.stringify({ products }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("FETCH PRODUCTS ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}