import fs from "node:fs";
import { zipSync } from "fflate";
import { route, HttpError, ID_RE } from "@/lib/http";
import { locate } from "@/lib/files";
import { getDB } from "@/lib/store";
import { renderExport, type OutFormat } from "@/lib/export";
export const dynamic = "force-dynamic";

export const GET = route(async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const ids = (sp.get("ids") || "").split(",").filter((i) => ID_RE.test(i) && i.startsWith("img_")).slice(0, 100);
  if (!ids.length) throw new HttpError(400, "Choose at least one image.");
  const f = sp.get("format") || "original";
  const wm = sp.get("wm") === "1" ? { ...getDB(user.uid).settings.watermark, enabled: true } : undefined;
  const files: Record<string, Uint8Array> = {};
  for (const id of ids) {
    const loc = locate(user.uid, id);
    if (!loc) continue;
    if (f === "original" && !wm) files[`97-image-${id.slice(4, 12)}.${loc.ext}`] = new Uint8Array(await fs.promises.readFile(loc.file));
    else {
      const fmt = (["png", "jpeg", "webp"].includes(f) ? f : loc.ext === "jpg" ? "jpeg" : loc.ext) as OutFormat;
      files[`97-image-${id.slice(4, 12)}${wm ? "-97" : ""}.${fmt === "jpeg" ? "jpg" : fmt}`] = new Uint8Array(await renderExport(loc.file, fmt, wm));
    }
  }
  const zip = zipSync(files, { level: 0 });
  return new Response(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="97-image-export-${Date.now()}.zip"`, "Cache-Control": "no-store" } });
});
