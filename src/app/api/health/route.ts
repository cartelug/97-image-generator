import { route, ok } from "@/lib/http";
import { demoMode } from "@/lib/config";
export const dynamic = "force-dynamic";
export const GET = route(async () => ok({ ok: true, service: "97-image-generator", demo: demoMode() }), { public: true });
