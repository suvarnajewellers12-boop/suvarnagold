import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, returnedGoldGrams, wastageGrams, notes } = body;

    if (!id) {
      return new NextResponse(JSON.stringify({ error: "Job ID is required" }), { status: 400, headers: corsHeaders() });
    }

    // 🔥 TRANSACTION: Update Job and all linked Orders
    const updatedJob = await prisma.$transaction(async (tx) => {
      // 1. Update the GoldJobWork status
      const job = await tx.goldJobWork.update({
        where: { id: id },
        data: {
          status: "COMPLETED",
          dateReceived: new Date(),
          returnedGoldGrams: parseFloat(returnedGoldGrams) || null,
          wastageGrams: parseFloat(wastageGrams) || null,
          notes: notes ? `Completion Notes: ${notes}` : undefined
        }
      });

      // 2. Update all Orders linked to this specific JobWork ID
      await tx.order.updateMany({
        where: { jobWorkId: id },
        data: {
          status: "COMPLETED"
        }
      });

      return job;
    });

    return new NextResponse(
      JSON.stringify({ success: true, message: "Job and linked orders marked as completed", job: updatedJob }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("COMPLETION_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to complete job", details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}