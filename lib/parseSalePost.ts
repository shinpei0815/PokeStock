export type ParsedSalePost = {
  storeName: string | null;
  products: string[];
  status:
    | "in_stock"
    | "sold_out"
    | "low_stock"
    | "lottery"
    | "unknown";
  confidence: number;
};

function detectStatus(
  text: string
): ParsedSalePost["status"] {
  if (
    text.includes("完売しました") ||
    text.includes("完売いたしました") ||
    text.includes("完売となりました")
  ) {
    return "sold_out";
  }

  if (
    text.includes("残りわずか") ||
    text.includes("残り僅か") ||
    text.includes("残り少ない")
  ) {
    return "low_stock";
  }

  if (
    text.includes("抽選受付") ||
    text.includes("抽選販売") ||
    text.includes("抽選予約")
  ) {
    return "lottery";
  }

  if (
    text.includes("再入荷しました") ||
    text.includes("入荷しました") ||
    text.includes("販売開始") ||
    text.includes("先着販売") ||
    text.includes("在庫あり") ||
    text.includes("販売しております") ||
    text.includes("再販情報") ||
    text.includes("入荷情報")
  ) {
    return "in_stock";
  }

  return "unknown";
}

/**
 * 店舗名についている余計なプロフィール文言を削除
 */
function cleanStoreName(
  name: string
): string {
  let cleaned = name.trim();

  const removableBracketWords = [
    "スタッフ募集中",
    "アルバイト募集中",
    "求人募集中",
    "スタッフ募集",
    "アルバイト募集",
    "求人",
    "公式",
    "公式アカウント",
    "通販",
    "通販あり",
    "通販はこちら",
  ];

  // 【スタッフ募集中】などを削除
  cleaned = cleaned.replace(
    /【([^】]+)】/g,
    (fullMatch, content: string) => {
      const shouldRemove =
        removableBracketWords.some(
          (word) =>
            content.includes(word)
        );

      return shouldRemove
        ? ""
        : fullMatch;
    }
  );

  // [スタッフ募集中] のような形式も削除
  cleaned = cleaned.replace(
    /\[([^\]]+)\]/g,
    (fullMatch, content: string) => {
      const shouldRemove =
        removableBracketWords.some(
          (word) =>
            content.includes(word)
        );

      return shouldRemove
        ? ""
        : fullMatch;
    }
  );

  // 末尾の区切り文字を整理
  cleaned = cleaned
    .replace(/[｜|／/・\-–—]+$/g, "")
    .trim();

  // 連続スペースを1つに
  cleaned = cleaned.replace(
    /\s+/g,
    " "
  );

  return cleaned;
}

/**
 * 本文に書かれている有名店舗名を判定
 */
function extractKnownStoreFromText(
  text: string
): string | null {
  const stores: {
    pattern: RegExp;
    name: string;
  }[] = [
    {
      pattern: /GEO|ゲオ/i,
      name: "GEO（ゲオ）",
    },
    {
      pattern: /ヨドバシ/,
      name: "ヨドバシカメラ",
    },
    {
      pattern: /ビックカメラ/,
      name: "ビックカメラ",
    },
    {
      pattern:
        /ポケモンセンター|ポケセン/,
      name: "ポケモンセンター",
    },
    {
      pattern: /TSUTAYA/i,
      name: "TSUTAYA",
    },
    {
      pattern: /イオン/,
      name: "イオン",
    },
    {
      pattern: /トイザらス/,
      name: "トイザらス",
    },
    {
      pattern:
        /ブックオフ|BOOKOFF/i,
      name: "BOOKOFF",
    },
    {
      pattern: /ローソン/,
      name: "ローソン",
    },
    {
      pattern:
        /セブンイレブン|セブン-イレブン/,
      name: "セブンイレブン",
    },
    {
      pattern:
        /ファミリーマート|ファミマ/,
      name: "ファミリーマート",
    },
    {
      pattern: /エディオン/,
      name: "エディオン",
    },
    {
      pattern:
        /ジョーシン|Joshin/i,
      name: "Joshin",
    },
    {
      pattern:
        /ヤマダ電機|ヤマダデンキ/,
      name: "ヤマダデンキ",
    },
    {
      pattern:
        /ドンキホーテ|ドン・キホーテ/,
      name: "ドン・キホーテ",
    },
  ];

  const foundStore =
    stores.find(({ pattern }) =>
      pattern.test(text)
    );

  return foundStore?.name ?? null;
}

/**
 * Xの投稿者名が店舗っぽいか判定
 */
function extractStoreFromAuthor(
  authorName?: string | null,
  authorUsername?: string | null
): string | null {
  if (!authorName) {
    return null;
  }

  const storeWords = [
    "カードショップ",
    "トレカ",
    "TCG",
    "Trading Card",
    "CARD SHOP",
    "Card Shop",
    "ポケモンセンター",
    "ポケセン",
    "GEO",
    "ゲオ",
    "ヨドバシ",
    "ビックカメラ",
    "TSUTAYA",
    "BOOKOFF",
    "ブックオフ",
    "イオン",
    "トイザらス",
    "ホビー",
    "HOBBY",
    "ショップ",
    "SHOP",
    "店舗",
  ];

  const normalizedAuthorName =
    authorName.toLowerCase();

  const looksLikeStore =
    storeWords.some((word) =>
      normalizedAuthorName.includes(
        word.toLowerCase()
      )
    );

  if (!looksLikeStore) {
    return null;
  }

  return cleanStoreName(
    authorName
  );
}

/**
 * 店舗名判定
 *
 * 優先順位
 * 1. 本文中の明確な店舗名
 * 2. 店舗っぽい投稿者名
 */
function extractStoreName(
  text: string,
  authorName?: string | null,
  authorUsername?: string | null
): string | null {
  const textStore =
    extractKnownStoreFromText(text);

  if (textStore) {
    return textStore;
  }

  return extractStoreFromAuthor(
    authorName,
    authorUsername
  );
}

/**
 * 商品名抽出
 */
function extractProducts(
  text: string
): string[] {
  const products =
    new Set<string>();

  // 「商品名」
  const japaneseQuoteRegex =
    /「([^」]+)」/g;

  for (
    const match of text.matchAll(
      japaneseQuoteRegex
    )
  ) {
    const product =
      match[1]?.trim();

    if (
      product &&
      product.length >= 2 &&
      product.length <= 100
    ) {
      products.add(product);
    }
  }

  // 『商品名』
  const doubleQuoteRegex =
    /『([^』]+)』/g;

  for (
    const match of text.matchAll(
      doubleQuoteRegex
    )
  ) {
    const product =
      match[1]?.trim();

    if (
      product &&
      product.length >= 2 &&
      product.length <= 100
    ) {
      products.add(product);
    }
  }

  // 【】は商品っぽいものだけ採用
  const bracketRegex =
    /【([^】]+)】/g;

  for (
    const match of text.matchAll(
      bracketRegex
    )
  ) {
    const product =
      match[1]?.trim();

    if (!product) {
      continue;
    }

    const looksLikeProduct =
      product.includes(
        "CELEBRATION"
      ) ||
      product.includes("BOX") ||
      product.includes("デッキ") ||
      product.includes("パック") ||
      product.includes("ex") ||
      product.includes("EX");

    if (looksLikeProduct) {
      products.add(product);
    }
  }

  return Array.from(products);
}

export function parseSalePost(
  text: string,
  authorName?: string | null,
  authorUsername?: string | null
): ParsedSalePost {
  const storeName =
    extractStoreName(
      text,
      authorName,
      authorUsername
    );

  const products =
    extractProducts(text);

  const status =
    detectStatus(text);

  let confidence = 0.4;

  if (storeName) {
    confidence += 0.2;
  }

  if (
    products.length > 0
  ) {
    confidence += 0.2;
  }

  if (
    status !== "unknown"
  ) {
    confidence += 0.1;
  }

  if (
    authorName &&
    extractStoreFromAuthor(
      authorName,
      authorUsername
    )
  ) {
    confidence += 0.1;
  }

  confidence = Math.min(
    Number(
      confidence.toFixed(3)
    ),
    1
  );

  return {
    storeName,
    products,
    status,
    confidence,
  };
}