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
    // 1. AUTHORIZATION CHECK
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden: Admin access required" }), { 
        status: 403, headers: corsHeaders() 
      });
    }

    // 2. PARSE BODY
    const body = await req.json();
    const {  overallCost, products } = body;

    if (!overallCost || isNaN(Number(overallCost))) {
      return new NextResponse(JSON.stringify({ error: "A valid overall cost is required" }), { 
        status: 400, headers: corsHeaders() 
      });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new NextResponse(JSON.stringify({ error: "At least one product detail is required" }), { 
        status: 400, headers: corsHeaders() 
      });
    }

    // 3. EXECUTE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      
      const couponCode = `RTN-${Math.random().toString(36).toUpperCase().substring(2, 8)}`;
      const invoiceId = `#SVJ-CN-${Math.random().toString(36).toUpperCase().substring(2, 8)}`;
      // Create the Coupon and nest the product details
      const newCoupon = await tx.returnCoupon.create({
        data: {
          code: couponCode,
          cashAmount: Math.round(Number(overallCost)), // Total value for the customer
          isUsed: false,
          invoice: invoiceId, // Save the unique ID here

          creditNotes: {
            create: products.map((p: any) => ({
              productName: p.name,
              grams: Number(p.grams || 0),
              carats: String(p.carats || ""),
              stoneWeight: Number(p.stoneWeight || 0),
              overallCost: Number(overallCost) // Mapping the same overall cost to each entry for record keeping
            }))
          }
        },
        include: {
          creditNotes: true
        }
      });

      return {
        couponCode: newCoupon.code,
        totalAmount: newCoupon.cashAmount,
        productsLogged: newCoupon.creditNotes.length
      };
    }, {
      maxWait: 15000,
      timeout: 45000
    });

    return new NextResponse(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("CREDIT_NOTE_SYSTEM_ERROR:", error);
    const status = error.name === "JsonWebTokenError" ? 401 : 500;
    
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status, headers: corsHeaders() }
    );
  }
}