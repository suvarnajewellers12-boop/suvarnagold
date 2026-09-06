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

export async function DELETE(req: Request) {
  try {
    // AUTH
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    verifyToken(token);

    // BODY
    let body: { ids?: unknown };

    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.ids)) {
      return json(
        { error: "ids must be an array of product IDs" },
        400
      );
    }

    const ids = Array.from(
      new Set(
        body.ids
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      return json(
        { error: "Select at least one product to delete" },
        400
      );
    }

    if (ids.length > 500) {
      return json(
        { error: "Maximum 500 products can be deleted at once" },
        400
      );
    }

    // Find existing products
    const existingProducts = await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    const existingIds = existingProducts.map((product) => product.id);
    const existingIdSet = new Set(existingIds);

    const notFoundIds = ids.filter(
      (id) => !existingIdSet.has(id)
    );

    if (existingIds.length === 0) {
      return json(
        {
          error: "No matching products found",
          deletedCount: 0,
          deletedIds: [],
          notFoundIds,
        },
        404
      );
    }

    // Delete all selected products
    const deleted = await prisma.product.deleteMany({
      where: {
        id: {
          in: existingIds,
        },
      },
    });

    return json(
      {
        success: true,
        message: `${deleted.count} product${
          deleted.count === 1 ? "" : "s"
        } deleted successfully`,
        deletedCount: deleted.count,
        deletedIds: existingIds,
        notFoundIds,
        products: existingProducts,
      },
      200
    );
  } catch (error) {
    console.error("Bulk delete product error:", error);

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