import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  };
}

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function DELETE(req: Request) {
  try {
    // Parse request body
    const body = await req.json();
    const { phone } = body;

    // Validate phone number
    if (!phone || typeof phone !== "string") {
      return new NextResponse(
        JSON.stringify({ error: "Phone number is required in request body" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // Find customer by phone number
    const customer = await prisma.customer.findFirst({
      where: { phone },
      include: {
        coupons: true,
        schemes: true,
      },
    });

    if (!customer) {
      return new NextResponse(
        JSON.stringify({ error: "Customer not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    // ========================= DELETE USING TRANSACTION =========================
    // This ensures all-or-nothing deletion to maintain data integrity
    const deletedCustomer = await prisma.$transaction(async (tx) => {
      // Step 1: Delete all PaymentHistory records linked to customer's schemes
      // This must be done first since PaymentHistory references CustomerScheme
      const paymentHistoryDeleted = await tx.paymentHistory.deleteMany({
        where: {
          customerScheme: {
            customerId: customer.id,
          },
        },
      });
      console.log(
        `[DELETE-CUSTOMER] Deleted ${paymentHistoryDeleted.count} payment history records`
      );

      // Step 2: Delete all CustomerScheme records for this customer
      // This must be done after PaymentHistory since CustomerScheme has a relation
      const customerSchemesDeleted = await tx.customerScheme.deleteMany({
        where: { customerId: customer.id },
      });
      console.log(
        `[DELETE-CUSTOMER] Deleted ${customerSchemesDeleted.count} customer scheme enrollments`
      );

      // Step 3: Delete all Coupon records for this customer
      // This can be done in parallel with schemes since they're independent
      const couponsDeleted = await tx.coupon.deleteMany({
        where: { customerId: customer.id },
      });
      console.log(
        `[DELETE-CUSTOMER] Deleted ${couponsDeleted.count} coupons`
      );

      // Step 4: Finally, delete the customer record
      const deletedCustRecord = await tx.customer.delete({
        where: { id: customer.id },
      });
      console.log(
        `[DELETE-CUSTOMER] Deleted customer with ID: ${deletedCustRecord.id}`
      );

      return deletedCustRecord;
    });

    return new NextResponse(
      JSON.stringify({
        message: "Customer account deleted successfully",
        deletedCustomer: {
          id: deletedCustomer.id,
          name: deletedCustomer.name,
          phone: deletedCustomer.phone,
          username: deletedCustomer.username,
        },
        deletionDetails: {
          paymentHistoryRecordsDeleted: "See logs",
          customerSchemesDeleted: "See logs",
          couponsDeleted: "See logs",
          customerDeleted: true,
        },
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("[DELETE-CUSTOMER] Error:", error);

    // Handle specific Prisma errors
    if (error.code === "P2025") {
      return new NextResponse(
        JSON.stringify({ error: "Customer not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    if (error.code === "P2014") {
      return new NextResponse(
        JSON.stringify({
          error: "Cannot delete customer due to existing references",
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
