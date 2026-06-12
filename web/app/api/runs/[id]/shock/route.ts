import { NextResponse } from "next/server";

import { getApiBaseUrl, toUserFacingError } from "../../../../../lib/api";
import {
  RunShockRequest,
  RunShockResponse,
} from "../../../../../lib/api-types";


type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as RunShockRequest;
    const response = await fetch(`${getApiBaseUrl()}/runs/${id}/shock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      return NextResponse.json(
        {
          data: null,
          error: toUserFacingError(
            errorPayload?.detail,
            "Unable to queue the market shock right now.",
          ),
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as RunShockResponse;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Unable to queue the market shock.",
      },
      { status: 503 },
    );
  }
}
