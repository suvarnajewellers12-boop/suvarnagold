import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 Handle preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // change port
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
    });

    return new NextResponse(
      JSON.stringify({ admins }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (error) {
    console.error("Fetch admins error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
