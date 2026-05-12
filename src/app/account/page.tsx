import { Mail, LogOut } from "lucide-react";
import { format } from "date-fns";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/session";

export const metadata = {
  title: "Account",
};

export const dynamic = "force-dynamic";

/*
 * /account — minimal account screen. Email + "Signed in since" + Sign out.
 *
 * Password change, email change, and account deletion are deliberately
 * deferred — a personal app shared with a few friends doesn't need them
 * yet. When someone forgets a password, the owner runs a one-off SQL
 * update.
 */
export default async function AccountPage() {
  const { user } = await requireSession();

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader title="Account" backHref="/" backLabel="Garage" />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-bg-overlay p-2">
            <Mail className="h-5 w-5 text-fg-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-fg-muted">
              Email
            </p>
            <p className="truncate font-medium text-fg-primary">
              {user.email}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-subtle">
          <p className="text-xs text-fg-muted">
            Account created {format(user.createdAt, "MMM d, yyyy")}
          </p>
        </div>
      </Card>

      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary" size="lg">
          <LogOut className="h-5 w-5" />
          Sign out
        </Button>
      </form>
    </main>
  );
}
