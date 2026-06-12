import {
  HealthResponse,
  CounterfactualReplayResponse,
  RunDetailResponse,
  RunRecord,
  RunSummary,
} from "./api-types";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiSuccess<T> = {
  data: T;
  error: null;
  status: number;
};

type ApiFailure = {
  data: null;
  error: string;
  status: number | null;
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;


async function fetchApi<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        data: null,
        error: `Request failed with status ${response.status}.`,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { data, error: null, status: response.status };
  } catch {
    return {
      data: null,
      error: "Simulation service is unavailable.",
      status: null,
    };
  }
}


export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function toUserFacingError(
  detail: string | undefined,
  fallback: string,
): string {
  if (!detail) {
    return fallback;
  }

  if (/(openai|api[_ -]?key|tokens?)/i.test(detail)) {
    return fallback;
  }

  return detail;
}


export async function getBackendHealth(): Promise<ApiResult<HealthResponse>> {
  return fetchApi<HealthResponse>("/health");
}


export async function getRuns(): Promise<ApiResult<RunSummary[]>> {
  return fetchApi<RunSummary[]>("/runs");
}


export async function getRun(id: string): Promise<ApiResult<RunRecord>> {
  return fetchApi<RunRecord>(`/runs/${id}`);
}


export async function getRunDetail(
  id: string,
): Promise<ApiResult<RunDetailResponse>> {
  return fetchApi<RunDetailResponse>(`/runs/${id}/detail`);
}


export async function getRunCounterfactualReplay(
  id: string,
): Promise<ApiResult<CounterfactualReplayResponse>> {
  return fetchApi<CounterfactualReplayResponse>(`/runs/${id}/counterfactual`);
}
