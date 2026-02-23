import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, generateToken } from "@/lib/auth";
import { cors } from "@/lib/cors";

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { username },
    });

    if (!superAdmin) {
      return cors(
        NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    const isValid = await comparePassword(password, superAdmin.password);

    if (!isValid) {
      return cors(
        NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      );
    }

    const token = generateToken({
      id: superAdmin.id,
      role: "SUPER_ADMIN",
    });

    return cors(NextResponse.json({ token }));

  } catch (error) {
    return cors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
