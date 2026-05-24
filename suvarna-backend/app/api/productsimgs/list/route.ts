import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper (fully open)
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function GET(req: Request) {
  try {
    // 🔐 Authentication check (but no branch filtering - productImgs doesn't have branchName yet)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token); // Just verify the token is valid

    // For now, return all product images (productImgs table doesn't have branchName field)
    // TODO: Add branchName to ProductImgs schema and implement branch filtering
    const products = await prisma.productImgs.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      weight: p.weight,
      image: `data:image/jpeg;base64,${Buffer.from(p.image).toString("base64")}`,
      metalType: p.metalType,
      carats: p.carats,
    }));

    return new NextResponse(JSON.stringify(formatted), {
      status: 200,
      headers: corsHeaders(),
    });

  } catch (error) {
    console.error("Fetch error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}