import { proxyGet } from "@/lib/backend";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return proxyGet(`/sessions/${sessionId}`);
}
