import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Super Schema",
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: May 1, 2026
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What we collect</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Account data:</span> name,
                email, and a hashed password (we never store the plaintext password).
              </li>
              <li>
                <span className="font-medium text-foreground">Workspace content:</span>
                {" "}
                workspaces, projects, schemas, and the JSON/SQL you create.
              </li>
              <li>
                <span className="font-medium text-foreground">Session data:</span>{" "}
                authentication cookies issued by NextAuth so you stay signed in.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How we use it</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>To run the Service: persist your schemas, authenticate your sessions, and load your workspaces.</li>
              <li>To improve reliability: investigate bugs and operational issues.</li>
              <li>We do <span className="font-medium text-foreground">not</span> sell your data and do <span className="font-medium text-foreground">not</span> use Your Content to train AI models.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">AI processing</h2>
            <p className="text-muted-foreground">
              When you use AI-powered features, the prompt and minimum schema context
              required to fulfill the request are sent to a third-party large language
              model provider (currently Google Gemini via LangChain). Those providers
              process the request under their own terms. We do not retain prompts beyond
              the operation that produced them.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Storage</h2>
            <p className="text-muted-foreground">
              Account and schema data is stored in a PostgreSQL database via Prisma.
              Schema canvases also persist locally in your browser (localStorage) for
              autosave and offline editing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Cookies</h2>
            <p className="text-muted-foreground">
              We use first-party session cookies from NextAuth to keep you signed in. We
              do not use third-party advertising or tracking cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your choices</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>You can delete schemas and projects from your workspace at any time.</li>
              <li>You can request account deletion, after which your account and associated content are removed.</li>
              <li>You can clear local autosave data by clearing your browser&apos;s site data for this domain.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="text-muted-foreground">
              Passwords are hashed with bcrypt. Authentication is handled by NextAuth.
              No system is perfectly secure; you are responsible for using a strong,
              unique password.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Changes</h2>
            <p className="text-muted-foreground">
              We may update this policy as the Service evolves. Material changes will be
              reflected by updating the &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              Privacy questions can be sent to the project maintainer.
            </p>
          </section>
        </div>

        <div className="mt-12 flex items-center justify-between border-t pt-6 text-sm">
          <Link
            href="/terms"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            ← Terms &amp; Conditions
          </Link>
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Back to sign in →
          </Link>
        </div>
      </main>
    </div>
  );
}
