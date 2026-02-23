import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const body = await req.json();
    const { name, grams, cost } = body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        grams: Number(grams),
        cost: Number(cost),
      },
    });

    return new NextResponse(
      JSON.stringify({
        message: "Product updated successfully",
        product: updated,
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Update product error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
