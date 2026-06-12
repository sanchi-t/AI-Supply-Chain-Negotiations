import { NextResponse } from "next/server";

import { getApiBaseUrl, toUserFacingError } from "../../../lib/api";
import { RunSummary } from "../../../lib/api-types";


export async function GET() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/runs`, {
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
            "Unable to load saved runs right now.",
          ),
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as RunSummary[];
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Unable to load saved runs right now.",
      },
      { status: 503 },
    );
  }
}
