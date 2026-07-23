/**
 * Reads a dropped or pasted image file into a data URL. Data URLs are the only
 * form a browser can render for a local file: a `file://` path typed into the
 * DSL is blocked by the browser's security model when the page is served over
 * http(s), so we convert the bytes here instead of referencing the path.
 */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

/** The first image file in a clipboard or drag payload, if any. */
export function firstImageFile(source: DataTransfer | null | undefined): File | undefined {
  if (!source) return undefined;
  return Array.from(source.files).find((file) => file.type.startsWith("image/"));
}

/**
 * Whether the browser can actually paint this `src` in an `<img>`. `file://`
 * URLs cannot be loaded from an http(s) page, so we surface a hint instead of a
 * broken image. Everything else (http(s), `data:`, `blob:`, same-origin paths)
 * is assumed loadable.
 */
export function isDisplayableImageSrc(src: string | undefined | null): src is string {
  if (!src) return false;
  return !/^\s*file:/i.test(src);
}
