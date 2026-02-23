import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const product = await prisma.product.findUnique({
    where: { uniqueCode: code },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (product.isSold) {
    return NextResponse.json({ error: "Already sold" }, { status: 400 });
  }

  await prisma.product.update({
    where: { uniqueCode: code },
    data: {
      isSold: true,
      soldAt: new Date(),
    },
  });

  return NextResponse.json({ message: "Product marked as sold" });
}
