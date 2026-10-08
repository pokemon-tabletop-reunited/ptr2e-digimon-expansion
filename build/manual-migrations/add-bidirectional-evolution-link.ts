import { sluggify } from "build/lib/helpers.ts";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const packsDataPath = path.resolve(__dirname, "../../packs/species");

const links = new Map<string, Set<string>>();

for(const file of fs.readdirSync(packsDataPath)) {
  if(file.startsWith("_")) continue;
  const filePath = path.resolve(packsDataPath, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if(!data.system.node?.connected) throw new Error(`Missing system data in ${filePath}`);
  const slug = data.system.slug ?? sluggify(data.name);
  if(!data.system.node.connected.length) {
    if(!links.has(slug))
      links.set(slug, new Set());
    continue;
  }

  if(!links.has(slug))
    links.set(slug, new Set());
  
  const set = links.get(slug)!;
  for(const connected of data.system.node.connected) {
    set.add(connected);
    if(!links.has(connected))
      links.set(connected, new Set());
    links.get(connected)!.add(slug);
  }
}

for(const file of fs.readdirSync(packsDataPath)) {
  if(file.startsWith("_")) continue;
  const filePath = path.resolve(packsDataPath, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if(!data.system.node?.connected) throw new Error(`Missing system data in ${filePath}`);
  const list = links.get(data.system.slug ?? sluggify(data.name)) ?? new Set();
  data.system.node.connected = Array.from(list );
  
  fs.writeFileSync(filePath, JSON.stringify(data, null,+ 2));
}

