import { reverificationError } from "@clerk/shared/authorization-errors";
import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth } from "@/lib/auth";
import { localizedServerError } from "@/lib/server-errors";

type SessionClaimsWithRole = { role?: unknown };

export type ErasureStatusView = {
  requestId: string;
  status: "processing" | "completed" | "needs_support";
};

export type AdminErasureStatusView = ErasureStatusView & {
  errorCode: string | null;
  targetClerkId: string | null;
};

export type ErasureTarget = {
  clerkId: string;
  email: string;
  name: string;
};

export const requestSelfErasure = createServerFn({ method: "POST" })
  .validator(parseSelfErasureInput)
  .handler(async () => {
    const state = await clerkAuth();
    const clerkId = requireSignedInUser(state);
    if (!state.has({ reverification: "strict" })) {
      return reverificationError("strict");
    }

    const { s } = await import("@/lib/services");
    return statusView(
      await s.db.erasure.create({
        initiator: "self",
        subjectHmac: await subjectHmac(clerkId),
        targetClerkId: clerkId,
        verificationMethod: "clerk_reverification",
        verifiedAt: new Date(),
        verifiedByClerkId: clerkId,
      }),
    );
  });

export const getSelfErasureStatus = createServerFn().handler(async () => {
  const clerkId = selfErasureClerkId(await clerkAuth());
  if (!clerkId) return "signed_out" as const;
  const { s } = await import("@/lib/services");
  const request = await s.db.erasure.getReceiptBySubject(
    await subjectHmac(clerkId),
  );
  return request ? statusView(request) : null;
});

export function selfErasureClerkId(state: {
  isAuthenticated: boolean;
  userId: string | null;
}): string | null {
  return state.isAuthenticated ? state.userId : null;
}

export const isErasureAdmin = createServerFn().handler(async () => {
  const state = await activeAuth();
  return isAdmin(state);
});

export const findErasureTarget = createServerFn({ method: "GET" })
  .validator(parseEmailInput)
  .handler(async ({ data }) => {
    await requireAdmin();
    return await findClerkUserByEmail(data.email);
  });

export const requestAdminErasure = createServerFn({ method: "POST" })
  .validator(parseAdminErasureInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView> => {
    const adminClerkId = await requireAdmin();
    const target = await findClerkUserByEmail(data.email);
    if (!target || target.clerkId !== data.targetClerkId) {
      throw localizedServerError("error.generic");
    }

    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.create({
      initiator: "admin",
      subjectHmac: await subjectHmac(target.clerkId),
      targetClerkId: target.clerkId,
      verificationMethod: data.verificationMethod,
      verificationReference: data.verificationReference,
      verifiedAt: new Date(),
      verifiedByClerkId: adminClerkId,
    });
    return {
      ...statusView(request),
      errorCode: request.errorCode,
      targetClerkId: target.clerkId,
    };
  });

export const getAdminErasureStatus = createServerFn({ method: "GET" })
  .validator(parseRequestInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView | null> => {
    await requireAdmin();
    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.getForAdmin(data.requestId);
    return request
      ? {
          ...statusView(request),
          errorCode: request.errorCode,
          targetClerkId: request.targetClerkId,
        }
      : null;
  });

export const retryAdminErasure = createServerFn({ method: "POST" })
  .validator(parseRequestInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView> => {
    await requireAdmin();
    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.retry({ requestId: data.requestId });
    const adminRequest = await s.db.erasure.getForAdmin(request.id);
    return {
      ...statusView(request),
      errorCode: request.errorCode,
      targetClerkId: adminRequest?.targetClerkId ?? null,
    };
  });

export function parseSelfErasureInput(input: unknown) {
  if (
    typeof input !== "object" ||
    input === null ||
    !("confirmed" in input) ||
    input.confirmed !== true
  ) {
    throw localizedServerError("error.generic");
  }
  return { confirmed: true as const };
}

export function parseAdminErasureInput(input: unknown) {
  const value = record(input);
  const verificationMethod = value.verificationMethod;
  if (
    verificationMethod !== "authenticated_request" &&
    verificationMethod !== "verified_email"
  ) {
    throw localizedServerError("error.generic");
  }
  return {
    email: email(value.email),
    targetClerkId: requiredString(value.targetClerkId, 120),
    verificationMethod: verificationMethod as
      | "authenticated_request"
      | "verified_email",
    verificationReference: reference(value.verificationReference),
  };
}

function parseEmailInput(input: unknown) {
  return { email: email(record(input).email) };
}

function parseRequestInput(input: unknown) {
  return { requestId: requiredString(record(input).requestId, 120) };
}

function record(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw localizedServerError("error.generic");
  }
  return input as Record<string, unknown>;
}

function requiredString(input: unknown, maximum: number): string {
  if (typeof input !== "string") throw localizedServerError("error.generic");
  const value = input.trim();
  if (!value || value.length > maximum) {
    throw localizedServerError("error.generic");
  }
  return value;
}

function email(input: unknown): string {
  const value = requiredString(input, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    throw localizedServerError("error.generic");
  }
  return value;
}

function reference(input: unknown): string {
  const value = requiredString(input, 120);
  if (!/^[A-Za-z0-9:_-]+$/u.test(value)) {
    throw localizedServerError("error.generic");
  }
  return value;
}

function requireSignedInUser(state: {
  isAuthenticated: boolean;
  userId: string | null;
}): string {
  if (!state.isAuthenticated || !state.userId) {
    throw localizedServerError("error.generic");
  }
  return state.userId;
}

async function requireAdmin(): Promise<string> {
  const state = await activeAuth();
  if (!isAdmin(state) || !state.userId) {
    throw localizedServerError("error.generic");
  }
  return state.userId;
}

function isAdmin(state: { isAuthenticated: boolean; sessionClaims: unknown }) {
  const claims = state.sessionClaims as SessionClaimsWithRole | null;
  return state.isAuthenticated && claims?.role === "admin";
}

async function findClerkUserByEmail(
  targetEmail: string,
): Promise<ErasureTarget | null> {
  const { serverEnv } = await import("@/env/server");
  const response = await fetch(
    `https://api.clerk.com/v1/users?${new URLSearchParams({
      email_address: targetEmail,
      limit: "2",
    })}`,
    { headers: { Authorization: `Bearer ${serverEnv.CLERK_SECRET_KEY}` } },
  );
  if (!response.ok) throw localizedServerError("error.generic");
  const payload = (await response.json()) as unknown;
  const users = Array.isArray(payload)
    ? payload
    : typeof payload === "object" &&
        payload !== null &&
        "data" in payload &&
        Array.isArray(payload.data)
      ? payload.data
      : [];
  return (
    users
      .map((user) => parseClerkTarget(user, targetEmail))
      .find((user) => user !== null) ?? null
  );
}

async function subjectHmac(clerkId: string): Promise<string> {
  const [{ serverEnv }, { createErasureSubjectHmac }] = await Promise.all([
    import("@/env/server"),
    import("@package/services"),
  ]);
  return await createErasureSubjectHmac(clerkId, serverEnv.ERASURE_HMAC_SECRET);
}

function parseClerkTarget(
  input: unknown,
  targetEmail: string,
): ErasureTarget | null {
  if (typeof input !== "object" || input === null) return null;
  const user = input as Record<string, unknown>;
  const clerkId = typeof user.id === "string" ? user.id : null;
  const addresses = Array.isArray(user.email_addresses)
    ? user.email_addresses
    : [];
  const address = addresses.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "email_address" in item &&
      typeof item.email_address === "string" &&
      item.email_address.toLowerCase() === targetEmail,
  );
  if (!clerkId || !address) return null;
  const name = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string" && !!part)
    .join(" ");
  return { clerkId, email: targetEmail, name: name || targetEmail };
}

function statusView(request: {
  id: string;
  status: "pending" | "running" | "completed" | "needs_attention";
}): ErasureStatusView {
  return {
    requestId: request.id,
    status:
      request.status === "completed"
        ? "completed"
        : request.status === "needs_attention"
          ? "needs_support"
          : "processing",
  };
}
