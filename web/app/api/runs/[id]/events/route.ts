import { getApiBaseUrl } from "../../../../../lib/api";


type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const response = await fetch(`${getApiBaseUrl()}/runs/${id}/events`, {
      headers: {
        Accept: "text/event-stream",
      },
      cache: "no-store",
    });

    if (!response.ok || !response.body) {
      return new Response("Unable to open run event stream.", {
        status: response.status || 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Unable to reach the run event stream.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
