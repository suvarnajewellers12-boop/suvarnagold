import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyToken } from "@/lib/auth";
import { cors } from "@/lib/cors";

// 🔹 Handle preflight
export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }));
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return cors(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    // 🔐 Only SUPER_ADMIN can create admins
    if (decoded.role !== "SUPER_ADMIN") {
      return cors(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }

    const body = await req.json();
    const { username, branchName, state, password } = body;

    if (!username || !branchName || !state || !password) {
      return cors(
        NextResponse.json({ error: "All fields required" }, { status: 400 })
      );
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      return cors(
        NextResponse.json(
          { error: "Username already exists" },
          { status: 400 }
        )
      );
    }

    const hashedPassword = await hashPassword(password);

    const newAdmin = await prisma.admin.create({
      data: {
        username,
        branchName,
        state,
        password: hashedPassword,
        createdBy: decoded.id,
      },
    });

    return cors(
      NextResponse.json(
        {
          message: "Admin created successfully",
          admin: {
            id: newAdmin.id,
            username: newAdmin.username,
            branchName: newAdmin.branchName,
            state: newAdmin.state,
            createdAt: newAdmin.createdAt,
          },
        },
        { status: 201 }
      )
    );

  } catch (error) {
    console.error("Admin creation error:", error);

    return cors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}
