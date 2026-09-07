import { NextResponse } from "next/server";
import { Prisma, StaffRole } from "@prisma/client";
import { randomInt } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
const METHOD = "POST";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": `${METHOD},OPTIONS`,
    "Cache-Control": "no-store",
  };
}
function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function requireAdmin(req: Request): Promise<string> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) throw new RequestError("Unauthorized", 401);
  let decoded;
  try { decoded = await verifyToken(match[1]); }
  catch { throw new RequestError("Invalid Token", 401); }
  if (!decoded || typeof decoded !== "object" || !("id" in decoded) ||
      typeof decoded.id !== "string" || !decoded.id) {
    throw new RequestError("Invalid Token", 401);
  }
  // Staff business roles never grant SUPER_ADMIN privileges.
  if (!("role" in decoded) || decoded.role !== "SUPER_ADMIN") {
    throw new RequestError("Forbidden", 403);
  }
  return decoded.id;
}
async function readBody(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try { parsed = await req.json(); }
  catch { throw new RequestError("Invalid JSON body"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RequestError("Expected a JSON object");
  }
  return parsed as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${field} must be a non-empty string`);
  }
  return value.trim();
}
function parseRoles(value: unknown): StaffRole[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    throw new RequestError("roles must contain CASHIER, SALESMAN, or both");
  }
  const roles: StaffRole[] = [];
  for (const role of value) {
    if (role !== StaffRole.CASHIER && role !== StaffRole.SALESMAN) {
      throw new RequestError("Only CASHIER and SALESMAN are allowed");
    }
    if (!roles.includes(role)) roles.push(role);
  }
  return roles;
}
function parseBranch(value: unknown): string {
  const branch = text(value, "branch");
  if (branch.length > 120) throw new RequestError("branch must be at most 120 characters");
  return branch;
}
const textFields = [
  "fullName", "gender", "phoneNumber", "aadharNumber", "nomineeName",
  "nomineeRelation", "nomineePhoneNumber", "nomineeAddress",
] as const;
type StaffFields = Partial<Record<typeof textFields[number], string>> & {
  dateOfJoining?: Date;
  monthlySalary?: number;
  panCardNumber?: string | null;
  branch?: string;
  roles?: StaffRole[];
};
function parseFields(body: Record<string, unknown>, create: boolean): StaffFields {
  // The request uses plural `roles`; reject a misleading singular field.
  if ("role" in body) throw new RequestError("Use roles: [\"CASHIER\", \"SALESMAN\"] instead of role");
  const fields: StaffFields = {};
  for (const field of textFields) {
    if (create || body[field] !== undefined) fields[field] = text(body[field], field);
  }
  if (create || body.branch !== undefined) fields.branch = parseBranch(body.branch);
  if (create || body.roles !== undefined) fields.roles = parseRoles(body.roles);
  if (create || body.dateOfJoining !== undefined) {
    const date = new Date(text(body.dateOfJoining, "dateOfJoining"));
    if (Number.isNaN(date.getTime())) throw new RequestError("Invalid date of joining");
    fields.dateOfJoining = date;
  }
  if (create || body.monthlySalary !== undefined) {
    const salary = body.monthlySalary;
    if ((typeof salary !== "string" && typeof salary !== "number") ||
        (typeof salary === "string" && !salary.trim()) ||
        !Number.isFinite(Number(salary)) || Number(salary) < 0) {
      throw new RequestError("monthlySalary must be a valid non-negative number");
    }
    fields.monthlySalary = Number(salary);
  }
  if (body.panCardNumber !== undefined) {
    const pan = body.panCardNumber;
    if (pan !== null && typeof pan !== "string") throw new RequestError("Invalid PAN card number");
    fields.panCardNumber = typeof pan === "string" ? pan.trim() || null : null;
  }
  return fields;
}
// Explicit selection keeps passwordHash out of every successful response.
const staffSelect = {
  id: true, fullName: true, dateOfJoining: true, monthlySalary: true,
  gender: true, phoneNumber: true, aadharNumber: true, panCardNumber: true,
  nomineeName: true, nomineeRelation: true, nomineePhoneNumber: true,
  nomineeAddress: true, createdAt: true, createdBy: true,
  branch: true, roles: true,
} satisfies Prisma.StaffSelect;
function handleError(error: unknown) {
  if (error instanceof RequestError) return respond({ error: error.message }, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return respond({ error: "Phone, Aadhar, nominee phone or PAN already exists" }, 409);
    if (error.code === "P2025") return respond({ error: "Staff member not found" }, 404);
  }
  console.error("Staff operation failed"); // Do not log passwords or personal records.
  return respond({ error: "Internal Server Error" }, 500);
}

// POST /api/staff/create
// New staff must have one branch and at least one business role.
// Initial password remains the generated employee ID.
export async function POST(req: Request) {
  try {
    const createdBy = await requireAdmin(req);
    const body = await readBody(req);
    if ("newPassword" in body || "password" in body || "resetPassword" in body) {
      throw new RequestError("New staff use their employee ID as the initial password. Use the update route to change it.");
    }
    const fields = parseFields(body, true);
    const used = new Set((await prisma.staff.findMany({ select: { id: true } })).map(s => s.id));
    const available = Array.from({ length: 900 }, (_, i) => `SUV7${i + 100}`).filter(id => !used.has(id));
    while (available.length > 0) {
      const [staffId] = available.splice(randomInt(available.length), 1);
      const passwordHash = await hash(staffId, 12);
      try {
        const staff = await prisma.staff.create({
          data: {
            id: staffId, createdBy, passwordHash,
            fullName: fields.fullName!, gender: fields.gender!,
            dateOfJoining: fields.dateOfJoining!, monthlySalary: fields.monthlySalary!,
            phoneNumber: fields.phoneNumber!, aadharNumber: fields.aadharNumber!,
            panCardNumber: fields.panCardNumber ?? null,
            nomineeName: fields.nomineeName!, nomineeRelation: fields.nomineeRelation!,
            nomineePhoneNumber: fields.nomineePhoneNumber!, nomineeAddress: fields.nomineeAddress!,
            branch: fields.branch!, roles: fields.roles!,
          },
          select: staffSelect,
        });
        return respond({ message: "Staff created successfully. Initial password is the employee ID.", staff }, 201);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          // Retry only a primary-key collision, not another unique field.
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes("id")) continue;
        }
        throw error;
      }
    }
    return respond({ error: "Staff ID range SUV7xxx is full. Expand the ID format." }, 409);
  } catch (error) { return handleError(error); }
}
