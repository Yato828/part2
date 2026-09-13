import { handleFable } from "../src/lib/fableServer";

export const config = { runtime: "edge" };

export default function handler(req: Request) {
  return handleFable(req);
}
