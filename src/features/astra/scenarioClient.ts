import { partFetch } from "../../lib/http";
import { sessionId } from "./client";
import { IV_MS } from "../../lib/axiom";
import type { ChartScenario, ScenarioRequest } from "./scenario";
export async function requestScenario(
  request: ScenarioRequest,
  signal: AbortSignal,
): Promise<ChartScenario> {
  const response = await partFetch("/api/astra/scenario", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Part-Session": sessionId(),
    },
    body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Astra scenario server is unavailable.");
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string" ? body.error : "Scenario unavailable.",
    );
  if (
    !body ||
    typeof body !== "object" ||
    body.hypothetical !== true ||
    body.chainId !== "solana" ||
    body.mint !== request.mint ||
    body.pool !== request.pool ||
    body.interval !== request.interval ||
    body.steps !== request.steps ||
    !Array.isArray(body.points) ||
    body.points.length !== request.steps ||
    !Number.isFinite(body.anchor?.t) ||
    body.anchor.t <= 0 ||
    !(body.anchor?.price > 0) ||
    !Number.isFinite(body.anchor.price) ||
    typeof body.model !== "string" ||
    typeof body.explanation !== "string" ||
    !Array.isArray(body.assumptions) ||
    body.assumptions.length > 5 ||
    body.assumptions.some(
      (a: unknown) => typeof a !== "string" || a.length > 400,
    ) ||
    !Number.isFinite(body.generatedAt) ||
    !Number.isFinite(body.snapshotAt) ||
    !body.explanation.trim() ||
    body.explanation.length > 1600 ||
    typeof body.source !== "string"
  )
    throw new Error("Invalid scenario response.");
  if (
    body.points.some(
      (p: { t: number; price: number }, i: number) =>
        !p ||
        p.t !== body.anchor.t + IV_MS[request.interval] * (i + 1) ||
        !Number.isFinite(p.price) ||
        p.price <= 0 ||
        Math.abs(p.price / body.anchor.price - 1) > 0.250001,
    )
  )
    throw new Error("Invalid scenario path.");
  return body;
}
