/**
 * Minimal ZIP (store method) writer/reader for portable DR archives.
 * No external dependency — keeps Cloudflare/Pages bundle lean.
 */

export type ZipEntry = { path: string; bytes: Uint8Array };

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >> 8) & 0xff;
  b[2] = (n >> 16) & 0xff;
  b[3] = (n >> 24) & 0xff;
  return b;
}

/** CRC32 for ZIP. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encodePath(path: string): Uint8Array {
  const clean = path.replace(/^\/+/, "").replace(/\\/g, "/");
  return new TextEncoder().encode(clean);
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encodePath(entry.path);
    const data = entry.bytes;
    const crc = crc32(data);
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, data);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    centralParts.push(central);
    offset += localHeader.length + data.length;
  }

  const centralDir = concat(centralParts);
  const local = concat(localParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(local.length),
    u16(0),
  ]);
  return concat([local, centralDir, end]);
}

function readU16(buf: Uint8Array, o: number): number {
  return buf[o]! | (buf[o + 1]! << 8);
}

function readU32(buf: Uint8Array, o: number): number {
  return (
    (buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16) | (buf[o + 3]! << 24)) >>> 0
  );
}

/** Parse store-method ZIPs produced by buildZip (and compatible tools). */
export function parseZip(buf: Uint8Array): ZipEntry[] {
  // Find EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (readU32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive");
  const count = readU16(buf, eocd + 10);
  let centralOffset = readU32(buf, eocd + 16);
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (readU32(buf, centralOffset) !== 0x02014b50) throw new Error("Corrupt ZIP central directory");
    const method = readU16(buf, centralOffset + 10);
    const compSize = readU32(buf, centralOffset + 20);
    const nameLen = readU16(buf, centralOffset + 28);
    const extraLen = readU16(buf, centralOffset + 30);
    const commentLen = readU16(buf, centralOffset + 32);
    const localOff = readU32(buf, centralOffset + 42);
    const nameBytes = buf.slice(centralOffset + 46, centralOffset + 46 + nameLen);
    const path = new TextDecoder().decode(nameBytes);
    if (method !== 0) throw new Error(`Unsupported ZIP compression method ${method} for ${path}`);
    const nameLenLocal = readU16(buf, localOff + 26);
    const extraLocal = readU16(buf, localOff + 28);
    const dataStart = localOff + 30 + nameLenLocal + extraLocal;
    const bytes = buf.slice(dataStart, dataStart + compSize);
    out.push({ path, bytes });
    centralOffset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
