import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
function crc32(b) {
  let crc = 0xffffffff;
  for (const v of b) {
    crc ^= v;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const xx = (x - size / 2) / size,
        yy = (y - size / 2) / size;
      const u = (xx - yy) * 0.7071,
        v = (xx + yy) * 0.7071;
      const dist = Math.hypot(Math.max(Math.abs(u) - 0.13, 0), v);
      const pill = (dist > 0.114 && dist < 0.158) || (Math.abs(u) < 0.018 && Math.abs(v) < 0.136);
      const i = y * (1 + size * 4) + 1 + x * 4;
      raw.set(pill ? [255, 255, 255, 255] : [25, 119, 109, 255], i);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
