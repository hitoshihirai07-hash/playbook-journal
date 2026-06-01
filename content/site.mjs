export const site = {
  title: "PLAYBOOK JOURNAL",
  shortTitle: "PLAYBOOK",
  description:
    "プロ野球とポケモンを、初心者にも分かりやすく整理する読みものサイト。",
  author: "PLAYBOOK JOURNAL 編集部",
  language: "ja",
  siteUrl: "https://playbook-journal.pages.dev",
  nav: [
    { href: "index.html", label: "ホーム" },
    { href: "baseball/index.html", label: "プロ野球" },
    { href: "pokemon/index.html", label: "ポケモン" },
    { href: "features/index.html", label: "特集" },
    { href: "about/index.html", label: "このサイトについて" },
  ],
  categories: {
    baseball: {
      name: "プロ野球",
      label: "BASEBALL",
      description:
        "数字の意味、観戦の楽しみ方、シーズンの見どころを分かりやすく整理します。",
      accent: "green",
    },
    pokemon: {
      name: "ポケモン",
      label: "POKEMON",
      description:
        "ゲームやカードを気軽に楽しむための、初心者向けガイドをまとめます。",
      accent: "purple",
    },
    features: {
      name: "特集・まとめ",
      label: "FEATURES",
      description:
        "最初に読みたい記事をテーマごとにまとめた、迷わないための入口です。",
      accent: "orange",
    },
  },
};
