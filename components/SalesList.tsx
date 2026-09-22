"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type XPost = {
  id: number;
  x_post_id: string;
  post_text: string;
  post_url: string | null;
  posted_at: string | null;
  author_name: string | null;
  author_username: string | null;
};

type SaleItem = {
  id: number;
  product_name: string | null;
  store_name: string | null;
  status: string;
  confidence: number | null;
  created_at: string;
  source_post: XPost | null;
};

type Props = {
  posts: SaleItem[];
};

type SaleGroup = {
  key: string;
  items: SaleItem[];
  sourcePost: XPost | null;
  storeName: string | null;
  status: string;
};

const statusLabel: Record<string, string> = {
  in_stock: "販売中",
  sold_out: "完売",
  low_stock: "残りわずか",
  lottery: "抽選受付中",
  unknown: "状況不明",
};

const statusStyle: Record<string, string> = {
  in_stock: "bg-green-100 text-green-700",
  sold_out: "bg-red-100 text-red-700",
  low_stock: "bg-yellow-100 text-yellow-700",
  lottery: "bg-blue-100 text-blue-700",
  unknown: "bg-gray-100 text-gray-700",
};

function getAgeMinutes(
  postedAt: string | null,
  now: number
) {
  if (!postedAt) {
    return null;
  }

  const postedTime = new Date(postedAt).getTime();

  if (Number.isNaN(postedTime)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((now - postedTime) / 1000 / 60)
  );
}

function getRelativeTime(
  ageMinutes: number | null
) {
  if (ageMinutes === null) {
    return "投稿時刻不明";
  }

  if (ageMinutes < 1) {
    return "たった今";
  }

  if (ageMinutes < 60) {
    return `${ageMinutes}分前`;
  }

  const hours = Math.floor(ageMinutes / 60);

  if (hours < 24) {
    return `${hours}時間前`;
  }

  const days = Math.floor(hours / 24);

  return `${days}日前`;
}

function getFreshness(
  ageMinutes: number | null
) {
  if (ageMinutes === null) {
    return {
      label: "時刻不明",
      className: "bg-gray-100 text-gray-600",
      cardClass: "",
    };
  }

  if (ageMinutes <= 60) {
    return {
      label: "新しい情報",
      className: "bg-green-100 text-green-700",
      cardClass: "",
    };
  }

  if (ageMinutes <= 180) {
    return {
      label: "少し前の情報",
      className: "bg-yellow-100 text-yellow-700",
      cardClass: "",
    };
  }

  return {
    label: "情報が古い可能性あり",
    className: "bg-gray-200 text-gray-600",
    cardClass: "opacity-70",
  };
}

function getDisplayStatus(
  status: string,
  ageMinutes: number | null
) {
  if (status !== "in_stock") {
    return {
      label:
        statusLabel[status] ??
        "状況不明",

      className:
        statusStyle[status] ??
        statusStyle.unknown,
    };
  }

  if (ageMinutes === null) {
    return {
      label: "販売情報あり",
      className:
        "bg-gray-100 text-gray-700",
    };
  }

  if (ageMinutes <= 60) {
    return {
      label: "販売中",
      className:
        "bg-green-100 text-green-700",
    };
  }

  if (ageMinutes <= 180) {
    return {
      label: "販売情報あり",
      className:
        "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "過去の販売情報",
    className:
      "bg-gray-200 text-gray-600",
  };
}

export default function SalesList({
  posts,
}: Props) {
  const [keyword, setKeyword] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState("all");

  const [selectedStore, setSelectedStore] =
    useState("all");

  const [status, setStatus] =
    useState("all");

  const [now, setNow] =
    useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);

    return () =>
      clearInterval(timer);
  }, []);

  // --------------------------------
  // 24時間以内だけ表示対象にする
  // --------------------------------

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      if (now === null) {
        return true;
      }

      const ageMinutes =
        getAgeMinutes(
          post.source_post?.posted_at ?? null,
          now
        );

      if (ageMinutes === null) {
        return true;
      }

      return ageMinutes < 24 * 60;
    });
  }, [posts, now]);

  // --------------------------------
  // 商品一覧
  // --------------------------------

  const productOptions = useMemo(() => {
    const products = new Set<string>();

    for (const post of visiblePosts) {
      if (post.product_name) {
        products.add(post.product_name);
      }
    }

    return Array.from(products).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "ja"
        )
    );
  }, [visiblePosts]);

  // --------------------------------
  // 店舗一覧
  // --------------------------------

  const storeOptions = useMemo(() => {
    const stores = new Set<string>();

    for (const post of visiblePosts) {
      if (post.store_name) {
        stores.add(post.store_name);
      }
    }

    return Array.from(stores).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "ja"
        )
    );
  }, [visiblePosts]);

  // --------------------------------
  // 同じX投稿を1カードにまとめる
  // --------------------------------

  const groupedPosts = useMemo(() => {
    const groupMap =
      new Map<string, SaleGroup>();

    for (const post of visiblePosts) {
      const sourcePost =
        post.source_post;

      const key =
        sourcePost?.id
          ? `x-${sourcePost.id}`
          : `sale-${post.id}`;

      const existing =
        groupMap.get(key);

      if (existing) {
        existing.items.push(post);
        continue;
      }

      groupMap.set(key, {
        key,
        items: [post],
        sourcePost,
        storeName:
          post.store_name,
        status:
          post.status,
      });
    }

    return Array.from(
      groupMap.values()
    );
  }, [visiblePosts]);

  // --------------------------------
  // 検索・絞り込み
  // --------------------------------

  const filteredGroups = useMemo(() => {
    return groupedPosts.filter((group) => {
      const searchKeyword =
        keyword
          .trim()
          .toLowerCase();

      const storeName =
        group.storeName
          ?.toLowerCase() ?? "";

      const productNames =
        group.items.map(
          (item) =>
            item.product_name
              ?.toLowerCase() ?? ""
        );

      const matchesKeyword =
        searchKeyword === "" ||
        storeName.includes(
          searchKeyword
        ) ||
        productNames.some(
          (productName) =>
            productName.includes(
              searchKeyword
            )
        );

      const matchesProduct =
        selectedProduct === "all" ||
        group.items.some(
          (item) =>
            item.product_name ===
            selectedProduct
        );

      const matchesStore =
        selectedStore === "all" ||
        group.items.some(
          (item) =>
            item.store_name ===
            selectedStore
        );

      const matchesStatus =
        status === "all" ||
        group.items.some(
          (item) =>
            item.status === status
        );

      return (
        matchesKeyword &&
        matchesProduct &&
        matchesStore &&
        matchesStatus
      );
    });
  }, [
    groupedPosts,
    keyword,
    selectedProduct,
    selectedStore,
    status,
  ]);

  const hasActiveFilters =
    keyword.trim() !== "" ||
    selectedProduct !== "all" ||
    selectedStore !== "all" ||
    status !== "all";

  function resetFilters() {
    setKeyword("");
    setSelectedProduct("all");
    setSelectedStore("all");
    setStatus("all");
  }

  return (
    <>
      {/* 検索・絞り込み */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {/* キーワード */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              キーワード検索
            </label>

            <input
              type="text"
              value={keyword}
              onChange={(e) =>
                setKeyword(
                  e.target.value
                )
              }
              placeholder="商品名・店舗名"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none transition focus:border-blue-500 sm:py-2.5"
            />
          </div>

          {/* 商品 */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              商品
            </label>

            <select
              value={selectedProduct}
              onChange={(e) =>
                setSelectedProduct(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-blue-500 sm:py-2.5"
            >
              <option value="all">
                すべての商品
              </option>

              {productOptions.map(
                (product) => (
                  <option
                    key={product}
                    value={product}
                  >
                    {product}
                  </option>
                )
              )}
            </select>
          </div>

          {/* 店舗 */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              店舗
            </label>

            <select
              value={selectedStore}
              onChange={(e) =>
                setSelectedStore(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-blue-500 sm:py-2.5"
            >
              <option value="all">
                すべての店舗
              </option>

              {storeOptions.map(
                (store) => (
                  <option
                    key={store}
                    value={store}
                  >
                    {store}
                  </option>
                )
              )}
            </select>
          </div>

          {/* 販売状況 */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              販売状況
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-blue-500 sm:py-2.5"
            >
              <option value="all">
                すべて
              </option>

              <option value="in_stock">
                販売情報
              </option>

              <option value="low_stock">
                残りわずか
              </option>

              <option value="sold_out">
                完売
              </option>

              <option value="lottery">
                抽選受付中
              </option>

              <option value="unknown">
                状況不明
              </option>
            </select>
          </div>
        </div>

        {/* 条件リセット */}
        {hasActiveFilters && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              絞り込み条件をリセット
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <p className="text-sm text-gray-500">
          {filteredGroups.length}
          件の販売情報
        </p>

        {hasActiveFilters && (
          <p className="text-xs font-bold text-blue-600">
            絞り込み中
          </p>
        )}
      </div>

      {/* 販売情報一覧 */}
      <div className="space-y-4">
        {filteredGroups.map(
          (group) => {
            const sourcePost =
              group.sourcePost;

            const ageMinutes =
              now === null
                ? null
                : getAgeMinutes(
                    sourcePost
                      ?.posted_at ??
                      null,
                    now
                  );

            const freshness =
              getFreshness(
                ageMinutes
              );

            const displayStatus =
              getDisplayStatus(
                group.status,
                ageMinutes
              );

            return (
              <article
                key={group.key}
                className={`overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 ${freshness.cardClass}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold text-gray-900 sm:text-xl">
                      {group.storeName ??
                        "店舗不明"}
                    </h2>

                    <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                      対象商品
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${displayStatus.className}`}
                    >
                      {
                        displayStatus.label
                      }
                    </span>

                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${freshness.className}`}
                    >
                      {
                        freshness.label
                      }
                    </span>
                  </div>
                </div>

                {/* 商品 */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map(
                    (item) => (
                      <Link
                        key={item.id}
                        href={`/sales/${item.id}`}
                        className="max-w-full break-words rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100 active:bg-gray-200"
                      >
                        {item.product_name ??
                          "商品名不明"}
                      </Link>
                    )
                  )}
                </div>

                {/* X投稿 */}
                {sourcePost?.post_text && (
                  <div className="mt-5 rounded-xl bg-gray-50 p-3 sm:p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 sm:text-base sm:leading-7">
                      {
                        sourcePost.post_text
                      }
                    </p>
                  </div>
                )}

                <div className="mt-5 border-t border-gray-100 pt-4">
                  {sourcePost?.posted_at && (
                    <>
                      <p className="text-sm font-bold text-gray-700">
                        {getRelativeTime(
                          ageMinutes
                        )}
                      </p>

                      <p className="mt-1 break-words text-xs text-gray-500 sm:text-sm">
                        投稿日時：
                        {new Date(
                          sourcePost.posted_at
                        ).toLocaleString(
                          "ja-JP"
                        )}
                      </p>
                    </>
                  )}

                  {sourcePost?.author_name && (
                    <p className="mt-1 break-words text-xs text-gray-500 sm:text-sm">
                      投稿者：
                      {
                        sourcePost.author_name
                      }

                      {sourcePost.author_username &&
                        ` (@${sourcePost.author_username})`}
                    </p>
                  )}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                    {group.items.length ===
                      1 && (
                      <Link
                        href={`/sales/${group.items[0].id}`}
                        className="text-sm font-bold text-gray-900 hover:underline"
                      >
                        詳細を見る →
                      </Link>
                    )}

                    {sourcePost?.post_url && (
                      <a
                        href={
                          sourcePost.post_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-blue-600 hover:underline"
                      >
                        Xの元投稿を見る →
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          }
        )}

        {filteredGroups.length ===
          0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-8">
            <p className="text-sm font-bold text-gray-700 sm:text-base">
              条件に一致する販売情報がありません。
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-sm font-bold text-blue-600 hover:underline"
              >
                絞り込み条件をリセット
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}