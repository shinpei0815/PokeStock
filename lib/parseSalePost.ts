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
    text.includes("完売いたしました")
  ) {
    return "sold_out";
  }

  if (
    text.includes("残りわずか") ||
    text.includes("残り僅か")
  ) {
    return "low_stock";
  }

  if (
    text.includes("抽選受付") ||
    text.includes("抽選販売")
  ) {
    return "lottery";
  }

  if (
    text.includes("再入荷しました") ||
    text.includes("入荷しました") ||
    text.includes("販売開始") ||
    text.includes("先着販売") ||
    text.includes("在庫あり") ||
    text.includes("販売しております")
  ) {
    return "in_stock";
  }

  return "unknown";
}

function extractStoreName(
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
      pattern: /ポケモンセンター|ポケセン/,
      name: "ポケモンセンター",
    },
    {
      pattern: /TSUTAYA/,
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
      pattern: /ブックオフ|BOOKOFF/i,
      name: "BOOKOFF",
    },
    {
      pattern: /ローソン/,
      name: "ローソン",
    },
    {
      pattern: /セブンイレブン|セブン-イレブン/,
      name: "セブンイレブン",
    },
    {
      pattern: /ファミリーマート|ファミマ/,
      name: "ファミリーマート",
    },
  ];

  const store = stores.find(({ pattern }) =>
    pattern.test(text)
  );

  return store?.name ?? null;
}

function extractProducts(text: string): string[] {
  const products = new Set<string>();

  // 「30th CELEBRATION」のような「」内を取得
  const japaneseQuoteRegex = /「([^」]+)」/g;

  for (const match of text.matchAll(japaneseQuoteRegex)) {
    const product = match[1]?.trim();

    if (product) {
      products.add(product);
    }
  }

  return Array.from(products);
}

export function parseSalePost(
  text: string
): ParsedSalePost {
  const storeName = extractStoreName(text);
  const products = extractProducts(text);
  const status = detectStatus(text);

  let confidence = 0.5;

  if (storeName) {
    confidence += 0.2;
  }

  if (products.length > 0) {
    confidence += 0.2;
  }

  if (status !== "unknown") {
    confidence += 0.1;
  }

  confidence = Math.min(confidence, 1);

  return {
    storeName,
    products,
    status,
    confidence,
  };
}