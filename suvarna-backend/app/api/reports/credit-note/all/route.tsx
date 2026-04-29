import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
export async function GET(req:any) {
  try {
    // 1. AUTHORIZATION CHECK
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token); // Verify validity (Role check optional here depending on policy)

    // 2. FETCH ALL COUPONS WITH THEIR NESTED CREDIT NOTES
    const creditNotesRegistry = await prisma.returnCoupon.findMany({
      include: {
        creditNotes: true, // Includes the list of products for each coupon
      },
      orderBy: {
        createdAt: "desc", // Latest returns first
      },
    });

    // 3. FORMAT DATA FOR FRONTEND
    // We ensure the "Overall Price" (cashAmount) is clear for each entry
    const formattedData = creditNotesRegistry.map((coupon) => ({
      couponId: coupon.id,
      couponCode: coupon.code,
      overallPrice: coupon.cashAmount, // This is the total value given to user
      isUsed: coupon.isUsed,
      date: coupon.createdAt,
      invoice: coupon.invoice,

      products: coupon.creditNotes.map((note) => ({
        name: note.productName,
        grams: note.grams,
        carats: note.carats,
        stoneWeight: note.stoneWeight,
      })),
    }));

    return new NextResponse(
      JSON.stringify({ success: true, data: formattedData }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error: any) 
  {
    console.error("FETCH_CREDIT_NOTES_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}