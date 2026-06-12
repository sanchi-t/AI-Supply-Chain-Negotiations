import { NextResponse } from "next/server";

import { getApiBaseUrl, toUserFacingError } from "../../../../../../lib/api";
import {
  CounterfactualBranchRunRequest,
  CounterfactualBranchRunResponse,
} from "../../../../../../lib/api-types";


type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as CounterfactualBranchRunRequest;
    const response = await fetch(`${getApiBaseUrl()}/runs/${id}/counterfactual/branch`, {
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
            "New version could not be completed right now.",
          ),
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as CounterfactualBranchRunResponse;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "New version could not be completed right now.",
      },
      { status: 503 },
    );
  }
}
