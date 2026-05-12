import Link from "next/link";
import { redirect } from "next/navigation";

import { signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/session";

/*
 * /signup — register a new account. Same shape as /login, plus a
 * confirm-password field. Successful signup auto-logs-in (the action
 * sets the session cookie) and redirects to /.
 *
 * Like /login, an existing session bumps you to /.
 */

export const metadata = {
  title: "Sign up",
};

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const session = await getSession();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-fg-primary">Garage</h1>
        <p className="mt-1 text-sm text-fg-secondary">Create your account</p>
      </div>

      <Card className="p-6">
        <form action={signUp} className="space-y-4">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters."
            required
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            required
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          {error && (
            <p
              className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg">
            Create account
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-fg-secondary">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
