import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔑 Await params to unwrap the dynamic route parameter
    const resolvedParams = await params;
    const staffId = resolvedParams.id;

    if (!staffId) {
      return new NextResponse(
        JSON.stringify({ error: "Staff ID is required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!existingStaff) {
      return new NextResponse(
        JSON.stringify({ error: "Staff member not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    await prisma.staff.delete({
      where: { id: staffId },
    });

    return new NextResponse(
      JSON.stringify({ message: "Staff deleted successfully", staffId }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Delete staff error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}