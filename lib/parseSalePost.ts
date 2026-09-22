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
function cleanStoreName(name: string): string {
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

  cleaned = cleaned.replace(
    /【([^】]+)】/g,
    (fullMatch, content: string) => {
      const shouldRemove =
        removableBracketWords.some((word) =>
          content.includes(word)
        );

      return shouldRemove ? "" : fullMatch;
    }
  );

  cleaned = cleaned.replace(
    /\[([^\]]+)\]/g,
    (fullMatch, content: string) => {
      const shouldRemove =
        removableBracketWords.some((word) =>
          content.includes(word)
        );

      return shouldRemove ? "" : fullMatch;
    }
  );

  cleaned = cleaned
    .replace(/[｜|／/・\-–—]+$/g, "")
    .trim();

  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned;
}

/**
 * 本文から有名店舗名を判定
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
 * 投稿者名から店舗判定
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

  return cleanStoreName(authorName);
}

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
 * 商品名候補を綺麗にする
 */
function cleanProductName(
  value: string
): string | null {
  let product = value.trim();

  // URLを除去
  product = product.replace(
    /https?:\/\/\S+/gi,
    ""
  );

  // ハッシュタグ以降を除去
  product = product.replace(
    /#\S.*$/g,
    ""
  );

  // 販売状況の文章を除去
  product = product.replace(
    /\s*(再入荷しました|再入荷|入荷しました|入荷|再販しました|再販|販売開始しました|販売開始|販売中|販売しております|在庫あり|完売しました|完売いたしました|完売となりました|完売).*$/i,
    ""
  );

  // 値段以降を除去
  product = product.replace(
    /\s*[¥￥]?\d[\d,]*円.*$/g,
    ""
  );

  product = product
    .replace(/^[✅☑️・■●★☆▶︎▶︎\s]+/g, "")
    .replace(/^[：:\-－]+/g, "")
    .replace(/[！!。、,]+$/g, "")
    .replace(/^["'「『【]+/g, "")
    .replace(/["'」』】]+$/g, "")
    .trim();

  if (
    product.length < 2 ||
    product.length > 80
  ) {
    return null;
  }

  const invalidProducts = [
    "ポケカ",
    "ポケモンカード",
    "ポケモンカードゲーム",
    "販売情報",
    "再販情報",
    "入荷情報",
    "販売商品",
    "商品",
  ];

  if (
    invalidProducts.includes(product)
  ) {
    return null;
  }

  if (
    product.includes("オリパ")
  ) {
    return null;
  }

  return product;
}

/**
 * 商品名をSetへ追加
 */
function addProduct(
  products: Set<string>,
  value: string | undefined
) {
  if (!value) {
    return;
  }

  const product =
    cleanProductName(value);

  if (product) {
    products.add(product);
  }
}

/**
 * 商品名抽出
 */
function extractProducts(
  text: string
): string[] {
  const products =
    new Set<string>();

  // --------------------------------
  // ① 「商品名」
  // --------------------------------

  const japaneseQuoteRegex =
    /「([^」]+)」/g;

  for (
    const match of text.matchAll(
      japaneseQuoteRegex
    )
  ) {
    addProduct(
      products,
      match[1]
    );
  }

  // --------------------------------
  // ② 『商品名』
  // --------------------------------

  const doubleQuoteRegex =
    /『([^』]+)』/g;

  for (
    const match of text.matchAll(
      doubleQuoteRegex
    )
  ) {
    addProduct(
      products,
      match[1]
    );
  }

  // --------------------------------
  // ③ 拡張パック ○○
  // 強化拡張パック ○○
  // ハイクラスパック ○○
  // --------------------------------

  const packRegex =
    /(?:強化拡張パック|拡張パック|ハイクラスパック)\s*[：:]?\s*[「『]?([^\n「」『』]+?)[」』]?(?=\s*(?:再入荷|入荷|再販|販売開始|販売中|販売しております|在庫あり|完売|$))/g;

  for (
    const match of text.matchAll(
      packRegex
    )
  ) {
    addProduct(
      products,
      match[1]
    );
  }

  // --------------------------------
  // ④ スターター系
  // --------------------------------

  const deckRegex =
    /(?:スターターデッキ|スターターセット|プレミアムデッキセット|デッキビルドBOX|スペシャルデッキセット)\s*[：:]?\s*[「『]?([^\n「」『』]+?)[」』]?(?=\s*(?:再入荷|入荷|再販|販売開始|販売中|販売しております|在庫あり|完売|$))/g;

  for (
    const match of text.matchAll(
      deckRegex
    )
  ) {
    addProduct(
      products,
      match[1]
    );
  }

  // --------------------------------
  // ⑤ BOX形式
  //
  // ブラックボルト BOX 再入荷
  // のような投稿
  // --------------------------------

  const boxRegex =
    /(?:^|\n)[✅☑️・■●★☆▶︎▶︎\s]*([^\n]{2,60}?\s+BOX)(?=\s*(?:再入荷|入荷|再販|販売開始|販売中|在庫あり|完売|$))/gi;

  for (
    const match of text.matchAll(
      boxRegex
    )
  ) {
    addProduct(
      products,
      match[1]
    );
  }

  // --------------------------------
  // ⑥
  // 商品名 再入荷しました
  //
  // ただし誤判定防止のため
  // 短い1行だけ対象
  // --------------------------------

  const lines =
    text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed =
      line.trim();

    if (
      trimmed.length < 2 ||
      trimmed.length > 80
    ) {
      continue;
    }

    const match =
      trimmed.match(
        /^[✅☑️・■●★☆▶︎▶︎\s]*(.+?)\s*(?:再入荷しました|入荷しました|販売開始しました|販売開始|在庫あり)$/
      );

    if (!match) {
      continue;
    }

    const candidate =
      match[1];

    // 情報系タイトルは商品扱いしない
    if (
      candidate.includes(
        "販売情報"
      ) ||
      candidate.includes(
        "再販情報"
      ) ||
      candidate.includes(
        "入荷情報"
      ) ||
      candidate.includes(
        "ポケカ"
      ) ||
      candidate.includes(
        "ポケモンカード"
      )
    ) {
      continue;
    }

    addProduct(
      products,
      candidate
    );
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