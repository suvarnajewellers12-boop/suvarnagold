import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const body = await req.json();
    
    // 🔹 Destructure all new fields, removing 'cost'
    const { 
      name, 
      metalType, 
      carats, 
      category, 
      bodyPart, 
      grams, 
      stoneWeight, 
      netWeight, 
      quantity, 
      huid 
    } = body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        metalType,
        carats,
        category,
        bodyPart,
        huid,
        // 🔹 Ensure numbers are parsed correctly
        grams: grams !== undefined ? parseFloat(grams) : undefined,
        stoneWeight: stoneWeight !== undefined ? parseFloat(stoneWeight) : undefined,
        netWeight: netWeight !== undefined ? parseFloat(netWeight) : undefined,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
      },
    });

    return new NextResponse(
      JSON.stringify({
        message: "Product updated successfully",
        product: updated,
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Update product error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}