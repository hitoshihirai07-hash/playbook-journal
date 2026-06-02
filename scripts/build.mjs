import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { articles } from "../content/articles.mjs";
import { site } from "../content/site.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const docsDir = path.resolve(rootDir, "docs");
const staticDir = path.resolve(rootDir, "static");

if (!docsDir.startsWith(`${rootDir}${path.sep}`)) {
  throw new Error("Output directory must stay inside the site workspace.");
}

const articleBySlug = new Map(articles.map((article) => [article.slug, article]));

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const outputPathForArticle = (article) =>
  `articles/${article.category}/${article.slug}/index.html`;

const directoryHref = (fromOutput, toOutput) => {
  const fromDir = path.posix.dirname(fromOutput);
  let href = path.posix.relative(fromDir, toOutput);

  if (href.endsWith("index.html")) {
    href = href.slice(0, -"index.html".length);
  }

  return href || "./";
};

const assetHref = (fromOutput, assetPath) =>
  path.posix.relative(path.posix.dirname(fromOutput), assetPath);

const absoluteUrl = (outputPath) => {
  if (!site.siteUrl) {
    return "";
  }

  return `${site.siteUrl.replace(/\/$/, "")}/${outputPath.replace(/index\.html$/, "")}`;
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${date}T00:00:00+09:00`));

const navHtml = (fromOutput, active) =>
  site.nav
    .map((item) => {
      const current = item.href === "index.html" ? active === "home" : item.href.startsWith(`${active}/`);
      return `<a href="${escapeHtml(directoryHref(fromOutput, item.href))}"${current ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
    })
    .join("");

const footerHtml = (fromOutput) => `
  <footer class="site-footer">
    <div class="footer-inner">
      <div>
        <a class="brand" href="${directoryHref(fromOutput, "index.html")}">
          <span class="brand-mark">P</span>
          <span>${escapeHtml(site.shortTitle)}</span>
        </a>
        <p class="footer-copy">好きなものを、少し深く楽しむために。</p>
      </div>
      <div class="footer-links">
        <a href="${directoryHref(fromOutput, "about/index.html")}">このサイトについて</a>
        <a href="${directoryHref(fromOutput, "disclaimer/index.html")}">免責事項</a>
        <a href="${directoryHref(fromOutput, "privacy/index.html")}">プライバシー</a>
      </div>
    </div>
  </footer>`;

const layout = ({
  fromOutput,
  active,
  title,
  description,
  body,
  structuredData,
  robots = "index,follow",
  includeCanonical = true,
}) => {
  const pageTitle = title ? `${title} | ${site.title}` : site.title;
  const canonical = includeCanonical ? absoluteUrl(fromOutput) : "";
  return `<!doctype html>
<html lang="${site.language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${escapeHtml(robots)}">
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
    <link rel="icon" href="${assetHref(fromOutput, "favicon.svg")}" type="image/svg+xml">
    <link rel="stylesheet" href="${assetHref(fromOutput, "assets/styles.css")}">
    <script defer src="${assetHref(fromOutput, "assets/site.js")}"></script>
    ${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>` : ""}
  </head>
  <body>
    <a class="skip-link" href="#content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="${directoryHref(fromOutput, "index.html")}">
          <span class="brand-mark">P</span>
          <span>${escapeHtml(site.shortTitle)}</span>
        </a>
        <button class="menu-button" type="button" aria-expanded="false" data-menu-button>メニュー</button>
        <nav class="site-nav" aria-label="メインナビゲーション" data-nav>
          ${navHtml(fromOutput, active)}
        </nav>
      </div>
    </header>
    <main class="main" id="content">
      ${body}
    </main>
    ${footerHtml(fromOutput)}
  </body>
</html>
`;
};

const writeOutput = async (outputPath, content) => {
  const fullPath = path.resolve(docsDir, outputPath);
  if (!fullPath.startsWith(`${docsDir}${path.sep}`)) {
    throw new Error(`Refusing to write outside docs: ${outputPath}`);
  }

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
};

const cardHtml = (article, fromOutput) => {
  const category = site.categories[article.category];
  const cardDate = article.updatedDate
    ? `${formatDate(article.updatedDate)} 更新`
    : formatDate(article.date);
  return `
    <article class="article-card">
      <div class="card-label">${escapeHtml(category.label)}</div>
      <h3><a href="${directoryHref(fromOutput, outputPathForArticle(article))}">${escapeHtml(article.title)}</a></h3>
      <p>${escapeHtml(article.description)}</p>
      <div class="article-meta">${escapeHtml(cardDate)} ・ ${escapeHtml(article.readingTime)}</div>
    </article>`;
};

const cardsHtml = (items, fromOutput) =>
  `<div class="article-grid">${items.map((article) => cardHtml(article, fromOutput)).join("")}</div>`;

const categoryPanelHtml = (slug, fromOutput) => {
  const category = site.categories[slug];
  const count = articles.filter((article) => article.category === slug).length;
  return `
    <article class="category-panel ${escapeHtml(category.accent)}">
      <div class="eyebrow">${escapeHtml(category.label)} ・ ${count} ARTICLES</div>
      <h2>${escapeHtml(category.name)}</h2>
      <p>${escapeHtml(category.description)}</p>
      <a href="${directoryHref(fromOutput, `${slug}/index.html`)}">記事を見る →</a>
    </article>`;
};

const renderHome = () => {
  const fromOutput = "index.html";
  const latest = [...articles]
    .sort((left, right) =>
      (right.updatedDate ?? right.date).localeCompare(left.updatedDate ?? left.date),
    )
    .slice(0, 6);
  const body = `
    <section class="hero">
      <div>
        <div class="eyebrow">READ, NOTICE, ENJOY.</div>
        <h1>好きなものを、<br>少し深く楽しむ。</h1>
        <p>プロ野球とポケモンを中心に、初めて触れる人にも分かりやすい読みものを届けます。速報を追いすぎず、あとから読み返せるガイドを丁寧に。</p>
        <div class="hero-actions">
          <a class="button" href="${directoryHref(fromOutput, "features/index.html")}">最初に読む記事</a>
          <a class="button secondary" href="#categories">カテゴリから探す</a>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-orbit"></div>
        <div class="hero-orbit second"></div>
        <div class="hero-dot one"></div>
        <div class="hero-dot two"></div>
        <div class="hero-panel">
          <strong>${articles.length}</strong>
          <span>PUBLISHED ARTICLES<br>公開中の読みもの</span>
        </div>
      </div>
    </section>
    <section class="section" id="categories">
      <div class="section-heading">
        <div>
          <div class="eyebrow">CATEGORIES</div>
          <h2>興味のある入口から</h2>
        </div>
      </div>
      <div class="category-grid">
        ${categoryPanelHtml("baseball", fromOutput)}
        ${categoryPanelHtml("pokemon", fromOutput)}
        ${categoryPanelHtml("features", fromOutput)}
      </div>
    </section>
    <section class="section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">LATEST ARTICLES</div>
          <h2>新着記事</h2>
        </div>
      </div>
      ${cardsHtml(latest, fromOutput)}
    </section>`;

  return layout({
    fromOutput,
    active: "home",
    title: "",
    description: site.description,
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.title,
      description: site.description,
      ...(site.siteUrl ? { url: site.siteUrl } : {}),
    },
  });
};

const renderCategory = (slug) => {
  const fromOutput = `${slug}/index.html`;
  const category = site.categories[slug];
  const categoryArticles = articles.filter((article) => article.category === slug);
  const body = `
    <section class="page-hero">
      <div class="eyebrow">${escapeHtml(category.label)}</div>
      <h1>${escapeHtml(category.name)}</h1>
      <p>${escapeHtml(category.description)}</p>
    </section>
    <section class="section">
      ${cardsHtml(categoryArticles, fromOutput)}
    </section>`;

  return layout({
    fromOutput,
    active: slug,
    title: category.name,
    description: category.description,
    body,
  });
};

const sectionHtml = (section, fromOutput) => {
  const paragraphs = (section.paragraphs ?? [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const list = section.list
    ? `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const links = section.links
    ? `<ul class="article-links">${section.links
        .map((link) => {
          const linkedArticle = articleBySlug.get(link.article);
          if (!linkedArticle) {
            throw new Error(`Unknown linked article: ${link.article}`);
          }
          return `<li><a href="${directoryHref(fromOutput, outputPathForArticle(linkedArticle))}">${escapeHtml(link.label)} →</a></li>`;
        })
        .join("")}</ul>`
    : "";
  const note = section.note ? `<aside class="note">${escapeHtml(section.note)}</aside>` : "";
  return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${list}${links}${note}</section>`;
};

const renderArticle = (article) => {
  const fromOutput = outputPathForArticle(article);
  const category = site.categories[article.category];
  const modifiedDate = article.updatedDate ?? article.date;
  const articleDateMeta = article.updatedDate
    ? `${formatDate(article.date)} 公開 ・ ${formatDate(article.updatedDate)} 更新 ・ ${article.readingTime}`
    : `${formatDate(article.date)} ・ ${article.readingTime}`;
  const tags = article.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const related = articles
    .filter((candidate) => candidate.category === article.category && candidate.slug !== article.slug)
    .slice(0, 3);
  const relatedHtml = related.length
    ? `
      <section class="section">
        <div class="section-heading">
          <div>
            <div class="eyebrow">RELATED ARTICLES</div>
            <h2>同じカテゴリの記事</h2>
          </div>
        </div>
        ${cardsHtml(related, fromOutput)}
      </section>`
    : "";

  const body = `
    <nav class="breadcrumbs" aria-label="パンくず">
      <a href="${directoryHref(fromOutput, "index.html")}">ホーム</a> /
      <a href="${directoryHref(fromOutput, `${article.category}/index.html`)}">${escapeHtml(category.name)}</a>
    </nav>
    <article>
      <header class="article-header">
        <div class="eyebrow">${escapeHtml(category.label)}</div>
        <h1>${escapeHtml(article.title)}</h1>
        <div class="article-meta">${escapeHtml(articleDateMeta)}</div>
        <p class="article-lead">${escapeHtml(article.lead)}</p>
        <div class="tags">${tags}</div>
      </header>
      <div class="article-body">
        ${article.sections.map((section) => sectionHtml(section, fromOutput)).join("")}
      </div>
      <footer class="article-footer">
        <h2>記事について</h2>
        <p>内容は公開時点で確認した情報をもとにしています。最新のルールや日程は、権利者や運営者が案内する公式情報で確認してください。</p>
      </footer>
    </article>
    ${relatedHtml}`;

  return layout({
    fromOutput,
    active: article.category,
    title: article.title,
    description: article.description,
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      datePublished: article.date,
      dateModified: modifiedDate,
      author: { "@type": "Organization", name: site.author },
      publisher: { "@type": "Organization", name: site.title },
      ...(absoluteUrl(fromOutput) ? { mainEntityOfPage: absoluteUrl(fromOutput) } : {}),
    },
  });
};

const renderInfoPage = ({ slug, title, description, content }) => {
  const fromOutput = `${slug}/index.html`;
  const body = `
    <section class="page-hero">
      <div class="eyebrow">INFORMATION</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="info-panel">${content}</section>`;

  return layout({
    fromOutput,
    active: slug === "about" ? "about" : "",
    title,
    description,
    body,
  });
};

const infoPages = [
  {
    slug: "about",
    title: "このサイトについて",
    description: "PLAYBOOK JOURNALの運営方針をご案内します。",
    content: `
      <h2>好きなものを、少し深く楽しむ</h2>
      <p>PLAYBOOK JOURNALは、プロ野球とポケモンを中心に、初心者にも読みやすいガイドを掲載する非公式の読みものサイトです。</p>
      <p>速報の転載や公式素材の再利用ではなく、あとから読み返せる整理された記事を目指します。</p>
      <h2>公式サイトではありません</h2>
      <p>本サイトは、日本野球機構、各球団、株式会社ポケモン、任天堂株式会社、その他の関係各社とは関係のない非公式サイトです。</p>
      <h2>掲載内容について</h2>
      <p>正確な情報の掲載に努めますが、日程、規則、サービス内容などは変更される場合があります。重要な判断の前には、各公式サイトで最新情報をご確認ください。</p>`,
  },
  {
    slug: "disclaimer",
    title: "免責事項",
    description: "PLAYBOOK JOURNALの免責事項をご案内します。",
    content: `
      <h2>情報の利用について</h2>
      <p>本サイトに掲載する情報は、正確性や最新性を保証するものではありません。本サイトの情報を利用したことによって生じた損害について、運営者は責任を負いません。</p>
      <h2>知的財産権について</h2>
      <p>本サイトに掲載する文章、サイトデザイン、自作図表の権利は、特別な記載がない限り本サイトの運営者に帰属します。各商品名、サービス名、商標などは、それぞれの権利者に帰属します。</p>
      <p>本サイトは非公式サイトです。公式ロゴ、キャラクター画像、選手写真、試合映像などを無断で掲載しない方針で運営します。</p>
      <h2>外部リンクについて</h2>
      <p>外部サイトの内容、安全性、提供されるサービスについて、本サイトは責任を負いません。</p>`,
  },
  {
    slug: "privacy",
    title: "プライバシーポリシー",
    description: "PLAYBOOK JOURNALのプライバシーポリシーをご案内します。",
    content: `
      <h2>アクセス解析と広告について</h2>
      <p>現在、本サイトではアクセス解析ツール、広告配信サービス、問い合わせフォームを設置していません。</p>
      <p>将来これらを導入する場合は、利用するサービス、取得される情報、Cookieの利用、問い合わせ窓口などをこのページに追記します。</p>
      <h2>変更について</h2>
      <p>運営内容の変更に応じて、本ポリシーを更新する場合があります。</p>`,
  },
];

const render404 = () => {
  const fromOutput = "404.html";
  const body = `
    <section class="page-hero">
      <div class="eyebrow">404 NOT FOUND</div>
      <h1>ページが見つかりません</h1>
      <p>URLが変更されたか、ページが削除された可能性があります。</p>
      <div class="hero-actions">
        <a class="button" href="${directoryHref(fromOutput, "index.html")}">ホームへ戻る</a>
      </div>
    </section>`;

  return layout({
    fromOutput,
    active: "",
    title: "ページが見つかりません",
    description: "ページが見つかりません。",
    body,
    robots: "noindex,follow",
    includeCanonical: false,
  });
};

const renderSitemap = () => {
  if (!site.siteUrl) {
    return "";
  }

  const latestDate = (items) =>
    items
      .map((item) => item.updatedDate ?? item.date)
      .filter(Boolean)
      .sort()
      .at(-1);
  const siteLatestDate = latestDate(articles);
  const entries = [
    { outputPath: "index.html", lastmod: siteLatestDate },
    ...Object.keys(site.categories).map((slug) => ({
      outputPath: `${slug}/index.html`,
      lastmod: latestDate(articles.filter((article) => article.category === slug)),
    })),
    ...articles.map((article) => ({
      outputPath: outputPathForArticle(article),
      lastmod: article.updatedDate ?? article.date,
    })),
    ...infoPages.map((page) => ({
      outputPath: `${page.slug}/index.html`,
      lastmod: page.updatedDate,
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(({ outputPath, lastmod }) => `  <url><loc>${escapeHtml(absoluteUrl(outputPath))}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`)
  .join("\n")}
</urlset>
`;
};

await rm(docsDir, { recursive: true, force: true });
await mkdir(docsDir, { recursive: true });
await cp(staticDir, docsDir, { recursive: true });

await writeOutput("index.html", renderHome());
for (const slug of Object.keys(site.categories)) {
  await writeOutput(`${slug}/index.html`, renderCategory(slug));
}
for (const article of articles) {
  await writeOutput(outputPathForArticle(article), renderArticle(article));
}
for (const page of infoPages) {
  await writeOutput(`${page.slug}/index.html`, renderInfoPage(page));
}

await writeOutput("404.html", render404());
await writeOutput(".nojekyll", "");
await writeOutput(
  "robots.txt",
  `User-agent: *
Allow: /
${site.siteUrl ? `Sitemap: ${site.siteUrl.replace(/\/$/, "")}/sitemap.xml\n` : ""}`,
);

const sitemap = renderSitemap();
if (sitemap) {
  await writeOutput("sitemap.xml", sitemap);
}

console.log(`Built ${articles.length} articles and ${infoPages.length + 5} pages in ${docsDir}`);
