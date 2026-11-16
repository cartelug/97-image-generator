import fs from "node:fs";
import { route, HttpError, safeId } from "@/lib/http";
import { locate } from "@/lib/files";
import { getDB } from "@/lib/store";
import { MIME, renderExport, type OutFormat } from "@/lib/export";
export const dynamic = "force-dynamic";

export const GET = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  safeId(id);
  const loc = locate(user.uid, id);
  if (!loc) throw new HttpError(404, "Image not found.");
  const sp = req.nextUrl.searchParams;
  const immutable = { "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
  try {
    if (sp.get("thumb")) return new Response(new Uint8Array(await fs.promises.readFile(loc.thumb)), { headers: { "Content-Type": "image/webp", ...immutable } });
    if (sp.get("dl")) {
      const f = sp.get("format") || "original";
      const wm = sp.get("wm") === "1" ? { ...getDB(user.uid).settings.watermark, enabled: true } : undefined;
      const short = id.slice(4, 12);
      if (f === "original" && !wm) {
        const buf = await fs.promises.readFile(loc.file);
        return new Response(new Uint8Array(buf), { headers: { "Content-Type": MIME[loc.ext] || "image/png", "Content-Disposition": `attachment; filename="97-image-${short}.${loc.ext}"`, "Cache-Control": "no-store" } });
      }
      const fmt = (["png", "jpeg", "webp"].includes(f) ? f : loc.ext === "jpg" ? "jpeg" : loc.ext) as OutFormat;
      const buf = await renderExport(loc.file, fmt, wm);
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": MIME[fmt], "Content-Disposition": `attachment; filename="97-image-${short}${wm ? "-97" : ""}.${fmt === "jpeg" ? "jpg" : fmt}"`, "Cache-Control": "no-store" } });
    }
    return new Response(new Uint8Array(await fs.promises.readFile(loc.file)), { headers: { "Content-Type": MIME[loc.ext] || "image/png", ...immutable } });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(404, "Image file is missing.");
  }
});
