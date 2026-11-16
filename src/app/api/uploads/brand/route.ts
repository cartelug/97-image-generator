import fs from "node:fs";
import path from "node:path";
import { route, ok } from "@/lib/http";
import { saveUpload } from "@/lib/files";
import { getDB } from "@/lib/store";
export const dynamic = "force-dynamic";

/** Adds the official THE 97 logo as a reference image, so it is never "re-drawn" by the model. */
export const POST = route(async (_req, _ctx, user) => {
  const existing = getDB(user.uid).assets.find((a) => a.brand);
  if (existing) return ok({ asset: existing });
  const buf = await fs.promises.readFile(path.join(process.cwd(), "public/brand/97.png"));
  return ok({ asset: await saveUpload(user.uid, buf, "THE 97 logo (official)", true) }, 201);
});
