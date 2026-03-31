import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
    // 🔐 Authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 Body Extraction
    const body = await req.json();
    const {
      name,
      metalType,
      grams,
      carats,
      manufactureDate,
      quantity,
      // NEW FIELDS
      huid,
      stoneWeight,
      netWeight,
      category,
      bodyPart,
    } = body;

    if (!quantity || quantity <= 0) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid quantity" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const createdItems = [];

    // 🔥 Loop for creating multiple items based on quantity
    for (let i = 0; i < quantity; i++) {
      
      // Get last product to increment SKU
      const lastProduct = await prisma.product.findFirst({
        orderBy: { createdAt: "desc" },
      });

      let nextNumber = 1;

      if (lastProduct?.sku) {
        // Extract the last 4 digits of the SKU and increment
        const lastNumberMatch = lastProduct.sku.match(/\d+$/);
        const lastNumber = lastNumberMatch ? parseInt(lastNumberMatch[0]) : 0;
        nextNumber = lastNumber + 1;
      }

      const year = new Date().getFullYear().toString().slice(-2);
      const sku = `SV${year}${String(nextNumber + i).padStart(4, "0")}`; // Added +i to ensure unique SKUs within the loop

      const uniqueCode = uuidv4();

      const product = await prisma.product.create({
        data: {
          sku,
          name,
          metalType,
          grams: parseFloat(grams),
          carats,
          manufactureDate: new Date(manufactureDate),
          uniqueCode,
          isSold: false,
          // MAPPING NEW FIELDS TO PRISMA
          huid: huid || null,
          stoneWeight: parseFloat(stoneWeight) || 0,
          netWeight: parseFloat(netWeight) || 0,
          category: category || "Other",
          bodyPart: bodyPart || "Other",
        },
      });

      createdItems.push({
        id: product.id,
        sku,
      });
    }

    return new NextResponse(
      JSON.stringify({
        message: `${quantity} products created`,
        items: createdItems,
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Product create error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}