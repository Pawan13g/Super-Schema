// Server-side error logging helper for API routes.
//
// Why this exists: `console.error(err)` dumps the full stack into stdout.
// In serverless logs that's fine and useful; if anyone ever pipes server
// logs into a client telemetry endpoint (Datadog browser RUM, Sentry
// client SDK reading from a stream, etc.) the stack can leak file paths,
// internal hostnames, query fragments. This helper:
//   - Generates a short request id so the user-facing 500 message can
//     reference the same id we logged on the server.
//   - Logs `[<route>] <id> <code>: <short-message>` plus the stack on a
//     SEPARATE line, so a log-redactor can strip just the stack line.
//   - Returns the id so the caller can include it in the response.

let counter = 0;

export function newRequestId(): string {
  // Time + monotonic counter is plenty for correlating one log line with
  // one HTTP response; we don't need cryptographic uniqueness.
  counter = (counter + 1) & 0xfffff;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function logServerError(
  scope: string,
  err: unknown,
  reqId: string,
  extra?: Record<string, unknown>
): void {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown";
  // Short summary line — safe to forward.
  console.error(
    `[${scope}] req=${reqId} ${extra ? JSON.stringify(extra) + " " : ""}${msg}`
  );
  // Full stack on its own line — log-redactors can drop lines starting
  // with `  at ` if they want.
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}
