import { NextResponse } from "next/server";
import { Prisma, StaffRole } from "@prisma/client";
import { Buffer } from "node:buffer";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
const METHOD = "PUT";

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

// PUT /api/staff/update
// Provided roles replace the whole roles list. Omitted fields are preserved.
export async function PUT(req: Request) {
  try {
    await requireAdmin(req);
    const body = await readBody(req);
    const staffId = text(body.staffId, "staffId");
    const fields = parseFields(body, false);
    if ("password" in body) throw new RequestError("Use newPassword to change the password");
    if (body.resetPassword !== undefined && typeof body.resetPassword !== "boolean") {
      throw new RequestError("resetPassword must be true or false");
    }
    const hasCustomPassword = body.newPassword !== undefined;
    const resetToEmployeeId = body.resetPassword === true;
    if (hasCustomPassword && resetToEmployeeId) {
      throw new RequestError("Provide newPassword or resetPassword: true, not both");
    }
    let customPassword: string | undefined;
    if (hasCustomPassword) {
      if (typeof body.newPassword !== "string" || body.newPassword.trim().length < 8) {
        throw new RequestError("New password must contain at least 8 characters excluding leading and trailing spaces");
      }
      if (Buffer.byteLength(body.newPassword, "utf8") > 72) {
        throw new RequestError("New password must not exceed 72 bytes");
      }
      customPassword = body.newPassword; // Preserve exactly what the admin entered.
    }
    const existing = await prisma.staff.findUnique({
      where: { id: staffId }, select: { id: true, passwordHash: true },
    });
    if (!existing) return respond({ error: "Staff member not found" }, 404);
    const passwordReset = hasCustomPassword || resetToEmployeeId;
    const nextHash = passwordReset || existing.passwordHash === null
      ? await hash(customPassword ?? staffId, 12) : null;
    const result = await prisma.$transaction(async tx => {
      let passwordInitialized = false;
      if (nextHash !== null && !passwordReset) {
        // Guard against overwriting a password set by a concurrent request.
        const initialized = await tx.staff.updateMany({
          where: { id: staffId, passwordHash: null }, data: { passwordHash: nextHash },
        });
        passwordInitialized = initialized.count > 0;
      }
      const data: Prisma.StaffUpdateInput = {
        ...fields,
        ...(fields.roles !== undefined ? { roles: { set: fields.roles } } : {}),
        ...(passwordReset && nextHash !== null ? { passwordHash: nextHash } : {}),
      };
      const staff = await tx.staff.update({ where: { id: staffId }, data, select: staffSelect });
      return { staff, passwordInitialized, passwordReset };
    });
    const message = hasCustomPassword ? "Staff updated successfully. Custom password saved."
      : resetToEmployeeId ? "Staff updated successfully. Password reset to employee ID."
      : result.passwordInitialized ? "Staff updated successfully. Initial password set to employee ID."
      : "Staff updated successfully";
    return respond({ message, ...result });
  } catch (error) { return handleError(error); }
}
