import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/session";

/*
 * /login — server component, form posts to signIn server action.
 *
 * Errors come back through `?error=<message>` because the action redirects
 * on both branches (success → /, failure → back here with the message).
 * Simpler than useFormState wiring for an MVP form with one error slot.
 *
 * If the user is already logged in, kick them to / so they don't see this
 * page after a fresh session. Mirrors /signup.
 */

export const metadata = {
  title: "Sign in",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) redirect("/");

  // searchParams is a Promise in Next 16 — await before reading.
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-fg-primary">Garage</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Sign in to your account
        </p>
      </div>

      <Card className="p-6">
        <form action={signIn} className="space-y-4">
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

          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
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
            Sign in
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-fg-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
