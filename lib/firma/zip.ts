import { crc32, deflateRawSync } from "node:zlib";

/**
 * Un fișier .zip din mai multe fișiere, fără pachete noi: formatul ZIP
 * (PKWARE APPNOTE) cu metoda 8 (deflate, din `node:zlib`), CRC-32 din
 * `zlib.crc32` și nume în UTF-8 (bitul 11). Fără ZIP64 — un pachet lunar
 * rămâne mult sub 4 GB. Fișierele deja comprimate (PDF, JPEG) se pun nemodificate (metoda 0).
 */

export interface ZipEntry {
  name: string;
  bytes: Buffer;
  date?: Date;
}

function dosTime(date: Date): { time: number; day: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const STORED = /\.(pdf|jpe?g|png|webp|heic|zip|gz|docx|xlsx|mp4)$/i;

export function makeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const used = new Set<string>();
  for (const entry of entries) {
    // Același nume de două ori: al doilea primește „ (2)”.
    let name = entry.name.replace(/[\\]/g, "/").replace(/^\/+/, "");
    for (let n = 2; used.has(name.toLowerCase()); n++) name = entry.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    const nameBytes = Buffer.from(name, "utf8");
    const store = STORED.test(name);
    const data = store ? entry.bytes : deflateRawSync(entry.bytes, { level: 9 });
    const checksum = crc32(entry.bytes) >>> 0;
    const { time, day } = dosTime(entry.date ?? new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
