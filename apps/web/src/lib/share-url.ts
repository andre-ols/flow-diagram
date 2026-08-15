import { gzipSync, gunzipSync, strFromU8, strToU8 } from "fflate";

const HASH_PREFIX = "#flow=";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encodeShareHash(source: string): Promise<string> {
  return HASH_PREFIX + toBase64Url(gzipSync(strToU8(source), { level: 9 }));
}

export async function decodeShareHash(hash: string): Promise<string | null> {
  if (!hash.startsWith(HASH_PREFIX)) return null;

  try {
    const payload = hash.slice(HASH_PREFIX.length);
    if (!payload) throw new Error("Empty payload");
    return strFromU8(gunzipSync(fromBase64Url(payload)));
  } catch (cause) {
    throw new Error("Invalid shared flow", { cause });
  }
}

export async function buildShareUrl(source: string, currentUrl: string): Promise<string> {
  const url = new URL(currentUrl);
  url.hash = await encodeShareHash(source);
  return url.toString();
}
