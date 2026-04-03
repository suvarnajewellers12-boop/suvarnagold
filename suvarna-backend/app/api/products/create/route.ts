import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const {
      name,
      metalType,
      grams,
      carats,
      manufactureDate,
      quantity,
      huid,
      stoneWeight,
      netWeight,
      category,
      bodyPart,
      branchName,
      va // 👈 NEW FIELD FROM FRONTEND
    } = body;

    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
      return new NextResponse(JSON.stringify({ error: "Invalid quantity" }), { status: 400, headers: corsHeaders() });
    }

    // --- ROBUST SKU GENERATION ---
    const year = new Date().getFullYear().toString().slice(-2); // "26"
    
    const lastProduct = await prisma.product.findFirst({
      where: {
        sku: { startsWith: `SV${year}` },
      },
      orderBy: { sku: "desc" },
    });

    let startNumber = 1;

    if (lastProduct?.sku) {
      const lastSequenceStr = lastProduct.sku.substring(4);
      const lastSequenceNum = parseInt(lastSequenceStr);
      
      if (!isNaN(lastSequenceNum)) {
        startNumber = lastSequenceNum + 1;
      }
    }

    const createdItems = [];

    // 🔥 Loop for creating multiple items
    for (let i = 0; i < qty; i++) {
      const sequence = String(startNumber + i).padStart(5, "0");
      const sku = `SV${year}${sequence}`;

      const product = await prisma.product.create({
        data: {
          sku,
          name,
          metalType,
          grams: parseFloat(grams) || 0,
          carats: carats || null,
          manufactureDate: new Date(manufactureDate),
          uniqueCode: uuidv4(),
          isSold: false,
          huid: huid || null,
          stoneWeight: parseFloat(stoneWeight) || 0,
          netWeight: parseFloat(netWeight) || 0,
          category: category || "Other",
          bodyPart: bodyPart || "Other",
          branchName: branchName || "Main",
          va: parseFloat(va) || 0, // 👈 SAVING VA TO DB
        },
      });

      createdItems.push({ id: product.id, sku: product.sku });
    }

    return new NextResponse(
      JSON.stringify({ message: `${qty} products created`, items: createdItems }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Product create error:", error);
    
    if (error.code === 'P2002') {
      return new NextResponse(
        JSON.stringify({ error: "SKU Collision: Please clean old corrupted SKUs from your database." }),
        { status: 409, headers: corsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}