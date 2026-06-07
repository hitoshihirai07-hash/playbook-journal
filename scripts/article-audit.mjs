import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { articles } from "../content/articles.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const docsDir = path.resolve(rootDir, "docs");
const reportDir = path.resolve(rootDir, "work", "reports", "articles");

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const optionValue = (prefix) => {
  const found = [...args].find((arg) => arg.startsWith(`${prefix}=`));
  return found ? found.slice(prefix.length + 1) : "";
};

const tokyoDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date());

const reportDate = optionValue("--date") || tokyoDate();
const expectedNewSlugs = optionValue("--expect-new")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);

const articlePath = (article) =>
  path.resolve(docsDir, "articles", article.category, article.slug, "index.html");

const walkFiles = async (directory, predicate, output = []) => {
  if (!existsSync(directory)) {
    return output;
  }

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, predicate, output);
    } else if (!predicate || predicate(fullPath)) {
      output.push(fullPath);
    }
  }

  return output;
};

const readText = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
};

const duplicateSlugs = [...articles.reduce((map, article) => {
  map.set(article.slug, (map.get(article.slug) || 0) + 1);
  return map;
}, new Map())]
  .filter(([, count]) => count > 1)
  .map(([slug]) => slug);

const requiredFields = [
  "slug",
  "category",
  "title",
  "description",
  "date",
  "readingTime",
  "tags",
  "lead",
  "sections",
  "sources",
];

const fieldIssues = [];
const articleBySlug = new Map(articles.map((article) => [article.slug, article]));

for (const article of articles) {
  for (const field of requiredFields) {
    const value = article[field];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0 && field !== "sources");

    if (missing) {
      fieldIssues.push(`${article.slug}: missing ${field}`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    fieldIssues.push(`${article.slug}: slug must use lowercase letters, numbers, and hyphens`);
  }

  if (!["baseball", "pokemon", "features"].includes(article.category)) {
    fieldIssues.push(`${article.slug}: unsupported category ${article.category}`);
  }
}

const linkIssues = [];

for (const article of articles) {
  for (const section of article.sections || []) {
    for (const link of section.links || []) {
      if (link.article && !articleBySlug.has(link.article)) {
        linkIssues.push(`${article.slug}: unknown internal link ${link.article}`);
      } else if (!link.article && !link.href) {
        linkIssues.push(`${article.slug}: link is missing article or href`);
      }
    }
  }
}

const missingOutputPages = articles
  .filter((article) => !existsSync(articlePath(article)))
  .map((article) => `${article.category}/${article.slug}`);

const expectedMissing = expectedNewSlugs.filter((slug) => !articleBySlug.has(slug));
const expectedOutputMissing = expectedNewSlugs
  .map((slug) => articleBySlug.get(slug))
  .filter(Boolean)
  .filter((article) => !existsSync(articlePath(article)))
  .map((article) => article.slug);

const adMarkers = [
  "pagead2.googlesyndication.com",
  "adsbygoogle",
  "amazon-adsystem.com",
  "a8.net",
  "rakuten.co.jp/com/",
];

const adMarkerHits = [];
const htmlFiles = await walkFiles(docsDir, (filePath) => filePath.endsWith(".html"));

for (const filePath of htmlFiles) {
  const html = await readText(filePath);
  for (const marker of adMarkers) {
    if (html.includes(marker)) {
      adMarkerHits.push(`${path.relative(docsDir, filePath)}: ${marker}`);
    }
  }
}

const counts = articles.reduce((result, article) => {
  result[article.category] = (result[article.category] || 0) + 1;
  return result;
}, {});

const issueCount =
  duplicateSlugs.length +
  fieldIssues.length +
  linkIssues.length +
  missingOutputPages.length +
  expectedMissing.length +
  expectedOutputMissing.length +
  adMarkerHits.length;

const list = (items) => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- なし");

const report = `# 記事制作監査レポート ${reportDate}

## サマリー
- 記事数: ${articles.length}
- カテゴリ内訳: baseball ${counts.baseball || 0}, pokemon ${counts.pokemon || 0}, features ${counts.features || 0}
- HTML記事ページ数: ${htmlFiles.filter((file) => file.includes(`${path.sep}articles${path.sep}`)).length}
- 期待した新規slug: ${expectedNewSlugs.length ? expectedNewSlugs.join(", ") : "指定なし"}
- 問題数: ${issueCount}

## slug重複
${list(duplicateSlugs)}

## 必須項目・形式
${list(fieldIssues)}

## 内部リンク
${list(linkIssues)}

## 生成ページ
${list(missingOutputPages)}

## 期待slugの確認
${list([...expectedMissing, ...expectedOutputMissing.map((slug) => `${slug}: output missing`)])}

## 広告タグ/外部広告スクリプト
${list(adMarkerHits)}
`;

await mkdir(reportDir, { recursive: true });
const reportPath = path.resolve(reportDir, `${reportDate}.md`);
await writeFile(reportPath, report, "utf8");

console.log(`Article audit report: ${path.relative(rootDir, reportPath)}`);
console.log(`Articles: ${articles.length}`);
console.log(`Issues: ${issueCount}`);

if (strict && issueCount > 0) {
  process.exitCode = 1;
}
