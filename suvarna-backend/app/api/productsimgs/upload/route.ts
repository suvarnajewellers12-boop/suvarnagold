import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    // 📦 FormData
    const formData = await req.formData();

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const weight = parseFloat(formData.get("weight") as string);
    const file = formData.get("image") as File;
    const metalType = formData.get("metalType") as string;
    const carats = formData.get("carats") as string;

    if (!file) {
      return new NextResponse(
        JSON.stringify({ error: "Image required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // Convert → Binary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const product = await prisma.productImgs.create({
      data: {
        title,
        description,
        weight,
        image: buffer,
        metalType,
        carats,
      },
    });

    return new NextResponse(
      JSON.stringify({ success: true, product }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Upload error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Upload failed" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}