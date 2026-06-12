import { NextResponse } from "next/server";

import { getApiBaseUrl, toUserFacingError } from "../../../../../lib/api";
import {
  SimulationBatchLaunchResult,
  SimulationRunConfig,
} from "../../../../../lib/api-types";


export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SimulationRunConfig;
    const response = await fetch(`${getApiBaseUrl()}/simulation/run/custom`, {
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
            "Simulation could not be completed right now.",
          ),
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as SimulationBatchLaunchResult;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Simulation could not be completed right now.",
      },
      { status: 503 },
    );
  }
}
