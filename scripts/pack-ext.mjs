import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { crc32 } from "node:zlib";

if (!existsSync("dist-ext/manifest.json")) {
  throw new Error("dist-ext/manifest.json missing — run npm run ext first");
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "part-ext.zip") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function zipFolder(root, outFile) {
  const files = walk(root);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const abs of files) {
    const name = relative(root, abs).split("\\").join("/");
    const data = readFileSync(abs);
    const crc = crc32(data) >>> 0;
    const nameBuf = Buffer.from(name);
    const local = Buffer.concat([
      Buffer.from("PK\x03\x04"),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      data,
    ]);
    const central = Buffer.concat([
      Buffer.from("PK\x01\x02"),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);
    centrals.push(central);
    locals.push(local);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.concat([
    Buffer.from("PK\x05\x06"),
    u16(0),
    u16(0),
    u16(locals.length),
    u16(locals.length),
    u32(cd.length),
    u32(offset),
    u16(0),
  ]);
  writeFileSync(outFile, Buffer.concat([...locals, cd, end]));
}

mkdirSync("public", { recursive: true });
zipFolder("dist-ext", "public/part-ext.zip");
console.log("packed public/part-ext.zip");
