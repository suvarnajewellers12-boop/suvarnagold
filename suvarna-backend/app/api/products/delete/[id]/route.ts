import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  };
}

function json(data: unknown, status: number) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ─────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    verifyToken(token);

    // ─────────────────────────────────────────────
    // PRODUCT ID
    // ─────────────────────────────────────────────
    const { id } = await params;

    if (!id?.trim()) {
      return json(
        { error: "Product ID is required" },
        400
      );
    }

    // ─────────────────────────────────────────────
    // CHECK PRODUCT
    // ─────────────────────────────────────────────
    const product = await prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      return json(
        { error: "Product not found" },
        404
      );
    }

    // ─────────────────────────────────────────────
    // DELETE PRODUCT
    // ─────────────────────────────────────────────
    const deleted = await prisma.product.delete({
      where: {
        id,
      },
    });

    return json(
      {
        success: true,
        message: "Product deleted successfully",
        deletedCount: 1,
        deletedIds: [id],
        product: deleted,
      },
      200
    );
  } catch (error) {
    console.error("Delete product error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return json(
      {
        error: "Internal server error",
        details: message,
      },
      500
    );
  }
}