import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Super Schema terms of service — usage, BYOK AI keys, intellectual property, and acceptable use.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Database className="size-4 text-primary" />
            </div>
            <span className="text-base font-bold">Super Schema</span>
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: May 1, 2026
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. Agreement</h2>
            <p className="text-muted-foreground">
              By creating an account or using Super Schema (the &ldquo;Service&rdquo;), you
              agree to these Terms &amp; Conditions. If you do not agree, do not use the
              Service. These terms apply to individuals and to teams using the Service on
              behalf of an organization.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. The Service</h2>
            <p className="text-muted-foreground">
              Super Schema is a visual database schema design tool. It lets you draft
              tables, columns, constraints, indexes, and relationships on a canvas, export
              schemas as SQL for PostgreSQL, MySQL, and SQLite, generate ORM models, and
              run AI-assisted operations such as schema generation, query writing, and
              schema explanations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. Your Account</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>You are responsible for the accuracy of the email and credentials you provide.</li>
              <li>You are responsible for activity that happens under your account.</li>
              <li>You must be at least 13 years old to create an account.</li>
              <li>One person or legal entity per account; do not share credentials.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Your Content</h2>
            <p className="text-muted-foreground">
              You retain ownership of the schemas, SQL, queries, and any other content you
              create using Super Schema (&ldquo;Your Content&rdquo;). You grant us a limited
              license to store, display, and process Your Content solely as necessary to
              operate the Service for you. We do not claim ownership of Your Content and
              do not use it to train third-party AI models.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. AI Features</h2>
            <p className="text-muted-foreground">
              Some features (schema generation, query generation, schema explanations,
              schema fixes, mock data) use third-party large language models. When you use
              these features, the prompt you submit and any schema context required to
              fulfill the request is sent to the underlying AI provider for processing.
              AI output may be inaccurate, incomplete, or insecure. You are responsible
              for reviewing AI-generated SQL or schemas before applying them to a real
              database.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Acceptable Use</h2>
            <p className="text-muted-foreground">You will not:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>Reverse engineer, scrape, or attempt to extract source code from the Service.</li>
              <li>Use the Service to build or train a competing product.</li>
              <li>Submit content you do not have the right to submit, including third-party confidential data.</li>
              <li>Attempt to bypass authentication, rate limits, or destructive-query safeguards.</li>
              <li>Use the Service for unlawful, harmful, or infringing activity.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Mock Database Sandbox</h2>
            <p className="text-muted-foreground">
              The query sandbox runs SELECT-only statements against an in-memory SQLite
              instance generated from your schema. It is provided as a convenience for
              experimentation. Results are not durable and should not be relied on for
              production validation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Beta &amp; Changes</h2>
            <p className="text-muted-foreground">
              The Service is under active development. Features may be added, changed, or
              removed without notice. We may update these Terms; continued use of the
              Service after an update constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Termination</h2>
            <p className="text-muted-foreground">
              You may delete your account at any time. We may suspend or terminate
              accounts that violate these Terms. On termination, Your Content may be
              deleted after a reasonable retention window.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. Disclaimers</h2>
            <p className="text-muted-foreground">
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind,
              express or implied. We do not warrant that generated SQL, schemas, or AI
              output will be correct, secure, or fit for any particular purpose.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">11. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, Super Schema and its operators are
              not liable for any indirect, incidental, special, consequential, or punitive
              damages, or for loss of data, profits, or business arising from your use of
              the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">12. Privacy</h2>
            <p className="text-muted-foreground">
              Our handling of personal data is described in our{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">13. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these Terms can be sent to the project maintainer.
            </p>
          </section>
        </div>

        <div className="mt-12 flex items-center justify-between border-t pt-6 text-sm">
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            ← Back to sign in
          </Link>
          <Link
            href="/privacy"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  );
}
