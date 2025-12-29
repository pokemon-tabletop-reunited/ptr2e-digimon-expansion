import fs from "fs";
import path from "path";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const packsDataPath = path.resolve(__dirname, "../../packs/species");

for(const file of fs.readdirSync(packsDataPath)) {
  if(file.startsWith("_")) continue;
  const filePath = path.resolve(packsDataPath, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if(!data.system) throw new Error(`Missing system data in ${filePath}`);
  if(!data.system.number || isNaN(Number(data.system.number))) continue;
  
  data.img = `modules/ptr2e-digimon-expansion/img/crystal-sprites/${data.system.number}.png`
  
  fs.writeFileSync(filePath, JSON.stringify(data, null,+ 2));
}