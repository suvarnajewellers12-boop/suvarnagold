import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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
    // 🔐 Authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token); // any logged-in user can view

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