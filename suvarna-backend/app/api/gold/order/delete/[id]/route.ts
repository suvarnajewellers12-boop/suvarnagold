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

// ------------------------------------------------------------
// OPTIONS
// ------------------------------------------------------------
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ------------------------------------------------------------
// DELETE ORDER
// DELETE /api/gold/order/OR-1001
// ------------------------------------------------------------
export async function DELETE(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // --------------------------------------------------------
    // AUTHORIZATION
    // --------------------------------------------------------
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: corsHeaders(),
        }
      );
    }

    const token = authHeader.slice(7);

    const decoded = verifyToken(token) as {
      id: string;
      role: string;
    };

    if (
      !decoded ||
      (decoded.role !== "SUPER_ADMIN" &&
        decoded.role !== "ADMIN")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        {
          status: 403,
          headers: corsHeaders(),
        }
      );
    }

    // --------------------------------------------------------
    // GET ORDER ID
    // --------------------------------------------------------
    const { id } = await context.params;

    const normalizedOrderId = decodeURIComponent(
      String(id || "")
    ).trim();

    if (!normalizedOrderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        {
          status: 400,
          headers: corsHeaders(),
        }
      );
    }

    // --------------------------------------------------------
    // CHECK ORDER EXISTS
    // --------------------------------------------------------
    const existingOrder = await prisma.order.findUnique({
      where: {
        orderId: normalizedOrderId,
      },
      select: {
        id: true,
        orderId: true,
        customerName: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        {
          status: 404,
          headers: corsHeaders(),
        }
      );
    }

    // --------------------------------------------------------
    // DELETE ORDER + RELATED DATA
    // --------------------------------------------------------
    await prisma.$transaction(async (tx) => {
      /*
       * Delete payments first.
       *
       * This prevents foreign-key errors if Payment -> Order
       * does not have onDelete: Cascade in Prisma schema.
       */
      await tx.payment.deleteMany({
        where: {
          orderId: existingOrder.id,
        },
      });

      /*
       * Add other related tables here if your Order model
       * has additional child relations without Cascade.
       *
       * Example:
       *
       * await tx.orderAssignment.deleteMany({
       *   where: {
       *     orderId: existingOrder.id,
       *   },
       * });
       */

      await tx.order.delete({
        where: {
          id: existingOrder.id,
        },
      });
    });

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        message: "Order deleted successfully",
        deletedOrder: {
          id: existingOrder.id,
          orderId: existingOrder.orderId,
          customerName: existingOrder.customerName,
        },
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("DELETE_ORDER_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: message,
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}