import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError, isDomainError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export { requireUser };
import { can, type Permission } from "@/lib/permissions";

export type RouteContext = { params: Promise<Record<string, string>> };

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (isDomainError(error)) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { ok: false, error: error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }
  console.error(error instanceof Error ? error.message : "Unhandled API error");
  return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
}

export function api(handler: (request: Request, context: RouteContext) => Promise<Response>) {
  return async (request: Request, context: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DomainError("Request body must be JSON", 400);
  }
}

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  }
  return parsed.data;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new DomainError("Forbidden", 403);
  }
  return user;
}
