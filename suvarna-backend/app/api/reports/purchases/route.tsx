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
  console.log("[PURCHASES API] Request received");
  
  try {
    // 1. Check Authorization
    const authHeader = req.headers.get("authorization");
    console.log("[PURCHASES API] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.log("[PURCHASES API] No auth header");
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    // 2. Verify Token
    let decoded: any;
    try {
      const token = authHeader.split(" ")[1];
      decoded = verifyToken(token);
      console.log("[PURCHASES API] Token verified. Role:", decoded.role, "ID:", decoded.id);
    } catch (tokenError) {
      console.error("[PURCHASES API] Token verification failed:", tokenError);
      return new NextResponse(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    // 3. Check Role
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      console.log("[PURCHASES API] Insufficient role:", decoded.role);
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, headers: corsHeaders() 
      });
    }

    // 4. Build where clause - fetch all purchases (no restrictions)
    const whereClause: any = {};

    // 5. Fetch purchases WITHOUT product relations first
    console.log("[PURCHASES API] Fetching purchases...");
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        admin: { select: { username: true } },
        superAdmin: { select: { username: true } },
        items: true, // First fetch all items without product relation
      },
      orderBy: { purchasedAt: "desc" },
    });

    console.log("[PURCHASES API] Found purchases count:", purchases.length);

    // 6. Fetch products separately and handle missing products
    const productIds = [...new Set(purchases.flatMap(p => p.items.map(i => i.productId)))];
    console.log("[PURCHASES API] Unique product IDs to fetch:", productIds.length);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));
    console.log("[PURCHASES API] Found products count:", products.length);

    // 7. Transform data
    const rows = purchases.flatMap((purchase) => {
      const createdBy = purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items
        .map((item) => {
          const product = productMap.get(item.productId);
          
          if (!product) {
            console.warn(`[PURCHASES API] Product missing for item ${item.id}, productId: ${item.productId}`);
            return null; // Skip items with missing products
          }

          return {
            id: purchase.id,
            paymentId: purchase.paymentId || "N/A",
            paymentStatus: purchase.paymentStatus,
            customerName: purchase.customerName,
            phoneNumber: purchase.phoneNumber,
            Address: purchase.Address || "N/A",
            emailid: purchase.emailid || "N/A",
            jewelleryexchangediscount: purchase.jewelleryexchangediscount,
            excahngejewellrygrams: purchase.excahngejewellrygrams,
            excahngejewellryname: purchase.excahngejewellryname,
            cardAmount: purchase.cardAmount,
            upiAmount: purchase.upiAmount,
            chequeAmount: purchase.chequeAmount,
            cashAmount: purchase.cashAmount,
            totalAmount: purchase.totalAmount,
            cgstAmount: purchase.cgstAmount,
            sgstAmount: purchase.sgstAmount,
            discountAmount: purchase.discountAmount,
            couponDiscount: purchase.couponDiscount,
            finalAmount: purchase.finalAmount,
            invoice: purchase.invoice,

            // Item specific fields
            productName: product.name,
            category: product.metalType,
            purity: product.carats,
            grossWt: product.grams,
            netWt: product.netWeight,
            va: product.va,
            itemCode: product.itemCode || "N/A",
            grams: item.grams,
            itemCost: item.cost,
            sku: product.sku || "N/A",
            purchasedAt: purchase.purchasedAt,
            stoneWeight: product.stoneWeight || 0,
            stoneCost: product.stoneCost || 0,
            createdBy: createdBy,
          };
        })
        .filter((row) => row !== null); // Remove null entries
    });

    console.log("[PURCHASES API] Final rows count:", rows.length);

    return new NextResponse(
      JSON.stringify({ purchases: rows }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("[PURCHASES API] ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new NextResponse(
      JSON.stringify({ error: "Server error", details: errorMessage }),
      { status: 500, headers: corsHeaders() }
    );
  }
}