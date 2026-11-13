// A minimal tar writer (POSIX ustar, regular files only), so several files can be shared as one: the
// database file with its write-ahead log (the log holds the newest data, so the .db file alone is not enough).
// `tar -xf` on any computer unpacks it. Pure: bytes in, bytes out.

export interface TarEntry {
  name: string;
  data: Uint8Array;
  /** Modified time, epoch ms. */
  mtime: number;
}

const BLOCK = 512;

function header(e: TarEntry): Uint8Array {
  if (!/^[\x20-\x7e]{1,100}$/.test(e.name)) throw new Error(`tar: name must be 1 to 100 plain characters: ${e.name}`);
  const h = new Uint8Array(BLOCK);
  const put = (text: string, at: number) => {
    for (let i = 0; i < text.length; i++) h[at + i] = text.charCodeAt(i);
  };
  const octal = (n: number, width: number) =>
    Math.floor(n)
      .toString(8)
      .padStart(width - 1, '0');
  put(e.name, 0);
  put(octal(0o600, 8), 100); // mode: owner read and write
  put(octal(0, 8), 108); // uid
  put(octal(0, 8), 116); // gid
  put(octal(e.data.length, 12), 124);
  put(octal(e.mtime / 1000, 12), 136);
  put('        ', 148); // the checksum field counts as spaces while summing
  put('0', 156); // regular file
  put('ustar', 257);
  put('00', 263);
  const sum = h.reduce((a, b) => a + b, 0);
  put(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return h;
}

export function tar(entries: readonly TarEntry[]): Uint8Array {
  const padded = (n: number) => Math.ceil(n / BLOCK) * BLOCK;
  const size = entries.reduce((n, e) => n + BLOCK + padded(e.data.length), 0) + 2 * BLOCK;
  const out = new Uint8Array(size);
  let at = 0;
  for (const e of entries) {
    out.set(header(e), at);
    out.set(e.data, at + BLOCK);
    at += BLOCK + padded(e.data.length);
  }
  return out; // ends with two empty blocks
}
