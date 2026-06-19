import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcCss = path.join(__dirname, "../src/styles/globals.css");
const distCss = path.join(__dirname, "../dist/styles.css");

fs.copyFileSync(srcCss, distCss);
console.log("✓ Copied styles.css to dist/");
