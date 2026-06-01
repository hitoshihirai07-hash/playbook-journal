import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(scriptDir, "..", "docs");
const htmlFiles = [];
const brokenLinks = [];

const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
};

const exists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

await walk(docsDir);

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  const links = html.matchAll(/(?:href|src)="([^"]+)"/g);

  for (const match of links) {
    const href = match[1];
    if (/^(?:https?:|#|mailto:)/.test(href)) {
      continue;
    }

    const cleanHref = href.split("#")[0].split("?")[0];
    const target = path.resolve(path.dirname(htmlFile), cleanHref);
    if (!(await exists(target))) {
      brokenLinks.push(`${path.relative(docsDir, htmlFile)} -> ${href}`);
    }
  }
}

console.log(`HTML files: ${htmlFiles.length}`);
console.log(`Broken local links: ${brokenLinks.length}`);

if (brokenLinks.length) {
  console.log(brokenLinks.join("\n"));
  process.exitCode = 1;
}
