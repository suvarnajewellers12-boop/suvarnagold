import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    verifyToken(token);

    const product = await prisma.productImgs.findUnique({
      where: { id: (await params).id },
    });

    if (!product) {
      return new NextResponse("Not found", {
        status: 404,
        headers: corsHeaders(),
      });
    }

    return new NextResponse(product.image, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "image/jpeg",
      },
    });

  } catch (error) {
    console.error("Image fetch error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch image" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}