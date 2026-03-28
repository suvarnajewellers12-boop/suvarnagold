// app/api/productsimgs/delete/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    // Check product exists
    const existing = await prisma.productImgs.findUnique({
      where: { id: (await params).id },
    });

    if (!existing) {
      return new NextResponse(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    await prisma.productImgs.delete({
      where: { id: (await params).id },
    });

    return new NextResponse(
      JSON.stringify({ message: "Product deleted successfully" }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Delete error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to delete product" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}