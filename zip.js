// Ghi file ZIP dạng stream, không nén (ảnh JPG/RAW vốn đã nén sẵn) — không cần thư viện ngoài.
// Hỗ trợ tên file Unicode và ZIP64 khi tổng dung lượng > 4GB.

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d = new Date()) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
const MAX32 = 0xffffffff;

class ZipWriter {
  constructor(write) { this.write = write; this.offset = 0; this.entries = []; this.names = new Set(); }

  uniqueName(name) {
    let n = name, i = 1;
    while (this.names.has(n.toLowerCase())) n = name.replace(/(\.[^.]*)?$/, m => ` (${i++})${m}`);
    this.names.add(n.toLowerCase());
    return n;
  }

  async addFile(name, data) {
    name = this.uniqueName(name);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data), size = data.length, { time, date } = dosDateTime();
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);           // version needed
    h.writeUInt16LE(0x0800, 6);       // cờ UTF-8
    h.writeUInt16LE(0, 8);            // store (không nén)
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(size, 18); h.writeUInt32LE(size, 22);
    h.writeUInt16LE(nameBuf.length, 26); h.writeUInt16LE(0, 28);
    this.entries.push({ nameBuf, crc, size, time, date, offset: this.offset });
    await this.write(h); await this.write(nameBuf); await this.write(data);
    this.offset += 30 + nameBuf.length + size;
  }

  async finish() {
    const cdStart = this.offset;
    for (const e of this.entries) {
      const z64 = e.offset >= MAX32;
      const extra = z64 ? Buffer.alloc(12) : Buffer.alloc(0);
      if (z64) { extra.writeUInt16LE(0x0001, 0); extra.writeUInt16LE(8, 2); extra.writeBigUInt64LE(BigInt(e.offset), 4); }
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(z64 ? 45 : 20, 4); c.writeUInt16LE(z64 ? 45 : 20, 6);
      c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
      c.writeUInt16LE(e.time, 12); c.writeUInt16LE(e.date, 14);
      c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.size, 20); c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.nameBuf.length, 28); c.writeUInt16LE(extra.length, 30);
      c.writeUInt32LE(z64 ? MAX32 : e.offset, 42);
      await this.write(c); await this.write(e.nameBuf); await this.write(extra);
      this.offset += 46 + e.nameBuf.length + extra.length;
    }
    const cdSize = this.offset - cdStart, n = this.entries.length;
    const needZ64 = cdStart >= MAX32 || n >= 0xffff;
    if (needZ64) {
      const r = Buffer.alloc(56);
      r.writeUInt32LE(0x06064b50, 0); r.writeBigUInt64LE(44n, 4);
      r.writeUInt16LE(45, 12); r.writeUInt16LE(45, 14);
      r.writeBigUInt64LE(BigInt(n), 24); r.writeBigUInt64LE(BigInt(n), 32);
      r.writeBigUInt64LE(BigInt(cdSize), 40); r.writeBigUInt64LE(BigInt(cdStart), 48);
      const loc = Buffer.alloc(20);
      loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(this.offset), 8); loc.writeUInt32LE(1, 16);
      await this.write(r); await this.write(loc);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Math.min(n, 0xffff), 8); end.writeUInt16LE(Math.min(n, 0xffff), 10);
    end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(needZ64 ? MAX32 : cdStart, 16);
    await this.write(end);
  }
}

module.exports = { ZipWriter };
