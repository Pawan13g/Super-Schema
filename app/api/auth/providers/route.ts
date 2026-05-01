import { enabledOAuthProviders } from "@/lib/auth.config";

export async function GET() {
  return Response.json(enabledOAuthProviders);
}
