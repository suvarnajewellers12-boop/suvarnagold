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

export async function GET(req: Request) {
  console.log("[ADMIN REPORTS] Request received");
  
  try {
    // 1. Auth & Verification
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log("[ADMIN REPORTS] No auth header");
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);
    console.log("[ADMIN REPORTS] Verified user - Role:", decoded.role, "ID:", decoded.id);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, headers: corsHeaders() 
      });
    }

    let purchases: any[] = [];

    // 2. Fetch purchases based on role
    if (decoded.role === "ADMIN") {
      console.log("[ADMIN REPORTS] ADMIN user - fetching all purchases from Admin.purchases");
      
      // Fetch admin with ALL their purchases (no date filter)
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        include: {
          purchases: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
            orderBy: { purchasedAt: "desc" },
          },
        },
      });

      purchases = admin?.purchases || [];
      console.log("[ADMIN REPORTS] Found purchases for admin:", purchases.length);
      
    } else {
      console.log("[ADMIN REPORTS] SUPER_ADMIN user - fetching all purchases");
      
      // For SUPER_ADMIN, fetch all purchases
      purchases = await prisma.purchase.findMany({
        include: {
          admin: { select: { username: true } },
          superAdmin: { select: { username: true } },
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { purchasedAt: "desc" },
      });
      
      console.log("[ADMIN REPORTS] Found total purchases:", purchases.length);
    }

    // 3. Flatten Items into Rows
    const rows = purchases.flatMap((purchase) => {
      const createdBy = purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items.map((item: any) => ({
        id: purchase.id,
        invoice: purchase.invoice,
        customerName: purchase.customerName,
        phoneNumber: purchase.phoneNumber,
        Address: purchase.Address || "N/A",
        emailid: purchase.emailid || "N/A",
        
        // Payment split
        payments: {
          cash: purchase.cashAmount || 0,
          upi: purchase.upiAmount || 0,
          card: purchase.cardAmount || 0,
          cheque: purchase.chequeAmount || 0,
        },

        // Financials
        subtotal: purchase.totalAmount,
        cgst: purchase.cgstAmount,
        sgst: purchase.sgstAmount,
        discount: purchase.discountAmount,
        couponDiscount: purchase.couponDiscount,
        exchangeDiscount: purchase.jewelleryexchangediscount,
        grandTotal: purchase.finalAmount,

        // Item specific fields
        productName: item.product.name,
        grams: item.product.grams,
        category: item.product.metalType,
        purity: item.product.carats,
        grossWt: item.product.grams,
        netWt: item.product.netWeight,
        va: item.product.va,
        itemCode: item.product.itemCode || "N/A",
        sku: item.product.sku || "N/A",
        itemCost: item.cost,
        
        // Metadata
        purchasedAt: purchase.purchasedAt,
        createdBy: createdBy,
      }));
    });

    console.log("[ADMIN REPORTS] Final rows count:", rows.length);

    return new NextResponse(
      JSON.stringify({ purchases: rows }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("[ADMIN REPORTS] ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new NextResponse(
      JSON.stringify({ error: "Server error", details: errorMessage }),
      { status: 500, headers: corsHeaders() }
    );
  }
}