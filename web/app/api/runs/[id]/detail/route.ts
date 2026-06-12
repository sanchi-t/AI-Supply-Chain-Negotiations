import { NextResponse } from "next/server";

import { getApiBaseUrl, toUserFacingError } from "../../../../../lib/api";
import { RunDetailResponse } from "../../../../../lib/api-types";


type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const response = await fetch(`${getApiBaseUrl()}/runs/${id}/detail`, {
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
            "Unable to load run detail right now.",
          ),
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as RunDetailResponse;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Unable to load run detail right now.",
      },
      { status: 503 },
    );
  }
}
