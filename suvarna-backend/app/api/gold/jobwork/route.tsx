import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}



export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const body = await req.json();
    const { 
      workerName, 
      orderIds, // These are now expected to be strings like ["OR-1001", "OR-1002"]
      productType,
      advancePaid, 
      makingCharge, 
      dateGiven,
      notes,
      totalAmount,
      balanceAmount
    } = body;

    if (!orderIds || orderIds.length === 0) {
      return new NextResponse(JSON.stringify({ error: "No order IDs provided" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // 1. VALIDATION: Fetch orders using the orderId field
    const selectedOrders = await prisma.order.findMany({
      where: {
        orderId: { in: orderIds }, // Targeting the orderId field specifically
      }
    });

    // Verify if all requested Order IDs actually exist
    if (selectedOrders.length !== orderIds.length) {
      const foundIds = selectedOrders.map(o => o.orderId);
      const missingIds = orderIds.filter((id: string) => !foundIds.includes(id));
      return new NextResponse(
        JSON.stringify({ error: `The following Order IDs do not exist: ${missingIds.join(", ")}` }), 
        { status: 404, headers: corsHeaders() }
      );
    }

    // Check if any of these orders are already assigned
    const alreadyAssigned = selectedOrders.filter(o => o.status !== "NOT ASSIGNED");
    if (alreadyAssigned.length > 0) {
      const ids = alreadyAssigned.map(o => o.orderId).join(", ");
      return new NextResponse(
        JSON.stringify({ error: `Orders already assigned: ${ids}` }), 
        { status: 400, headers: corsHeaders() }
      );
    }

    // Calculation
    const totalGrams = selectedOrders.reduce((sum, order) => sum + (order.netWeight || 0), 0);

    // 2. 🔥 PRISMA TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      
      // A. Create JobWork
      const jobwork = await tx.goldJobWork.create({
        data: {
          workerName,
          totalGrams,
          productType: productType || "Multiple Items",
          advancePaid: parseFloat(advancePaid) || 0,
          makingCharge: parseFloat(makingCharge) || 0,
          dateGiven: new Date(dateGiven),
          notes,
          status: "PENDING",
          totalAmount: parseFloat(totalAmount) || 0,
          createdBy: decoded.id,
          balanceAmount: parseFloat(balanceAmount) || 0
        },
      });

      // B. Update Orders targeting the orderId field
      await tx.order.updateMany({
        where: { 
            orderId: { in: orderIds } // Targeting the orderId field specifically
        },
        data: {
          status: "ASSIGNED",
          jobWorkId: jobwork.id,
        },
      });

      return jobwork;
    });

    return new NextResponse(
      JSON.stringify({ success: true, jobwork: result }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("ASSIGNMENT_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}