import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function DELETE(
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
    const decoded: any = verifyToken(token);

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    await prisma.admin.delete({
      where: { id },
    });

    return new NextResponse(
      JSON.stringify({ message: "Admin deleted successfully" }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Delete admin error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}

// 🔹 Reusable CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
