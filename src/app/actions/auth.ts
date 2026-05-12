"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/session";
import {
  formDataToObject,
  loginSchema,
  signupSchema,
} from "@/lib/validators";

/*
 * Auth server actions — phase 9a.
 *
 * Three actions:
 *   signUp  — create a new account + log in immediately
 *   signIn  — verify credentials + issue a session
 *   signOut — clear the session cookie
 *
 * Return shape: { error: string } on failure, redirect on success.
 * Pages render the error via `?error=<message>` search param so we don't
 * need useFormState wiring for the MVP. Once we have a heavier form
 * we can swap to useFormState/useActionState.
 *
 * Security notes (paranoid by design — friends will use this):
 *   - bcrypt cost 12 (≈250 ms per hash on the NAS). Slow enough to make
 *     brute-force impractical, fast enough that login still feels instant.
 *   - signIn returns a single generic "Invalid email or password" for both
 *     "no such email" and "wrong password" branches. Prevents account
 *     enumeration via the login form.
 *   - signUp DOES leak that an email is taken — the registration form has
 *     to tell the user something useful, and an attacker can probe the
 *     same info via signup anyway. Acceptable trade-off for UX.
 *   - Email is normalized (trim + lowercase) at the validator layer so
 *     case-folding doesn't create duplicate accounts.
 */

const BCRYPT_COST = 12;

// -----------------------------------------------------------------------------
// signUp
// -----------------------------------------------------------------------------
export async function signUp(formData: FormData) {
  const parsed = signupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    // First error wins for the redirect — full per-field errors will come
    // in 9b when the page can render them inline.
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true },
    });
    userId = user.id;
  } catch (err) {
    // P2002 = unique constraint violation. The User.email index is the
    // only unique field on this model, so any P2002 here is a dup email.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      redirect(
        `/signup?error=${encodeURIComponent(
          "An account with that email already exists"
        )}`
      );
    }
    throw err;
  }

  await setSessionCookie(userId);
  redirect("/");
}

// -----------------------------------------------------------------------------
// signIn
// -----------------------------------------------------------------------------
export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const { email, password } = parsed.data;

  // Single generic error message for both "no user" and "wrong password" so
  // the login form can't be used to probe which emails are registered.
  const GENERIC = encodeURIComponent("Invalid email or password");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Hash a dummy value when the user doesn't exist to keep response time
  // roughly constant — otherwise an attacker can time the difference between
  // "lookup failed (fast)" and "lookup hit + bcrypt compare (slow)" to
  // enumerate accounts. Constant-time is overkill but cheap to add.
  if (!user) {
    await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvali");
    redirect(`/login?error=${GENERIC}`);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    redirect(`/login?error=${GENERIC}`);
  }

  await setSessionCookie(user.id);
  redirect("/");
}

// -----------------------------------------------------------------------------
// signOut
// -----------------------------------------------------------------------------
export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
