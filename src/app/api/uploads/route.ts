import { route, ok, HttpError } from "@/lib/http";
import { saveUpload } from "@/lib/files";
import { MAX_REFS, MAX_UPLOAD_BYTES } from "@/lib/config";
export const dynamic = "force-dynamic";

export const POST = route(async (req, _ctx, user) => {
  const fd = await req.formData();
  const files = fd.getAll("files").filter((f): f is File => typeof f !== "string");
  if (!files.length) throw new HttpError(400, "No file received.");
  if (files.length > MAX_REFS) throw new HttpError(400, `Up to ${MAX_REFS} images at once.`);
  const assets = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) throw new HttpError(413, `“${f.name}” is larger than 20 MB.`);
    if (!/^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(f.type) && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) throw new HttpError(400, `“${f.name}” isn’t a supported image. Use PNG, JPEG or WebP.`);
    assets.push(await saveUpload(user.uid, Buffer.from(await f.arrayBuffer()), f.name || "reference"));
  }
  return ok({ assets }, 201);
});
