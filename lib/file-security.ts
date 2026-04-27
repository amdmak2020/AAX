import { randomUUID } from "crypto";

export type DetectedVideoType =
  | { mime: "video/mp4"; extension: "mp4" }
  | { mime: "video/quicktime"; extension: "mov" }
  | { mime: "video/x-m4v"; extension: "m4v" }
  | { mime: "video/webm"; extension: "webm" };

const encoder = new TextEncoder();
const ftypMagic = encoder.encode("ftyp");
const webmMarker = encoder.encode("webm");

function matchesAt(bytes: Uint8Array, offset: number, expected: Uint8Array) {
  if (offset < 0 || offset + expected.length > bytes.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected[index]) {
      return false;
    }
  }

  return true;
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return new TextDecoder("ascii").decode(bytes.slice(start, end));
}

function detectIsoBmffVideo(bytes: Uint8Array): DetectedVideoType | null {
  if (!matchesAt(bytes, 4, ftypMagic) || bytes.length < 12) {
    return null;
  }

  const brand = readAscii(bytes, 8, 12).trim().toLowerCase();
  if (brand === "qt") {
    return { mime: "video/quicktime", extension: "mov" };
  }

  if (brand === "m4v") {
    return { mime: "video/x-m4v", extension: "m4v" };
  }

  return { mime: "video/mp4", extension: "mp4" };
}

function detectWebm(bytes: Uint8Array): DetectedVideoType | null {
  if (bytes.length < 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
    return null;
  }

  const searchWindow = bytes.slice(0, Math.min(bytes.length, 96));
  for (let index = 0; index <= searchWindow.length - webmMarker.length; index += 1) {
    if (matchesAt(searchWindow, index, webmMarker)) {
      return { mime: "video/webm", extension: "webm" };
    }
  }

  return null;
}

export function detectVideoFileType(bytes: Uint8Array): DetectedVideoType | null {
  return detectIsoBmffVideo(bytes) ?? detectWebm(bytes);
}

export function buildRandomStorageName(extension: string) {
  const normalized = extension.replace(/^\.+/, "").toLowerCase();
  return `${randomUUID()}.${normalized}`;
}
