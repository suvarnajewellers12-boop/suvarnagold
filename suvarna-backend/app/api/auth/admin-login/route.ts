import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, generateToken } from "@/lib/auth";
import { cors } from "@/lib/cors";

// 🔹 Handle preflight
export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return cors(
        NextResponse.json(
          { error: "Username and password required" },
          { status: 400 }
        )
      );
    }

    // 🔍 Find admin
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return cors(
        NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        )
      );
    }

    // 🔐 Compare password
    const isValid = await comparePassword(password, admin.password);

    if (!isValid) {
      return cors(
        NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        )
      );
    }

    // 🎟 Generate token
    const token = generateToken({
      id: admin.id,
      role: admin.role,
      branchName: admin.branchName,
    });

    return cors(
      NextResponse.json({
        message: "Login successful",
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          branchName: admin.branchName,
          state: admin.state,
          role: admin.role,
        },
      })
    );

  } catch (error) {
    console.error("Admin login error:", error);

    return cors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}
