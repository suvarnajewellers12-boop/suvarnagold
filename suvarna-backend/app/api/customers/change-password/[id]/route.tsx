import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcrypt";


// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= UPDATE PASSWORD =================
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ FIXED

    if (!id) {
      return new NextResponse(
        JSON.stringify({ error: "Customer ID missing" }),
        { status: 400, headers: corsHeaders() }
      );
    }

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

    if (!decoded) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid Token" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    const { password } = await req.json();

    if (!password) {
      return new NextResponse(
        JSON.stringify({ error: "Password required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

   const hashedPassword = await bcrypt.hash(password, 10);

await prisma.customer.update({
  where: { id },
  data: { password: hashedPassword },
})

    return new NextResponse(
      JSON.stringify({ message: "Password updated successfully" }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Password update error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}