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
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: corsHeaders() 
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, 
        headers: corsHeaders() 
      });
    }

    const body = await req.json();
    const { 
      id, 
      returnedGoldGrams, 
      wastageGrams, 
      compNotes,
      // Financials passed from frontend to ensure balance becomes 0
      balanceAmount, 
    
    } = body;

    if (!id) {
      return new NextResponse(JSON.stringify({ error: "Job ID is required" }), { 
        status: 400, 
        headers: corsHeaders() 
      });
    }

    // 🔥 TRANSACTION: Update Job and all linked Orders
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Update the GoldJobWork: Set balance to 0 and update weight metrics
      const job = await tx.goldJobWork.update({
        where: { id: id },
        data: {
          status: "COMPLETED",
          dateReceived: new Date(),
          returnedGoldGrams: parseFloat(returnedGoldGrams) || 0,
          wastageGrams: parseFloat(wastageGrams) || 0,
          // 🔥 Financial Settlement
          balanceAmount: parseFloat(balanceAmount) || 0, // Frontend sends 0
          notes: compNotes ? `Completion Notes: ${compNotes}` : undefined
        }
      });

      // 2. Update all Orders linked to this specific JobWork ID to COMPLETED
      await tx.order.updateMany({
        where: { jobWorkId: id },
        data: {
          status: "COMPLETED"
        }
      });

      return job;
    });

    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: "Job finalized and balance settled to 0", 
        job: result 
      }),
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