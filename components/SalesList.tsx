"use client";

import { useState } from "react";
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

export default function SalesList({ posts }: Props) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");

  const filteredPosts = posts.filter((post) => {
    const productName =
      post.product_name?.toLowerCase() ?? "";

    const storeName =
      post.store_name?.toLowerCase() ?? "";

    const searchKeyword =
      keyword.toLowerCase();

    const matchesKeyword =
      productName.includes(searchKeyword) ||
      storeName.includes(searchKeyword);

    const matchesStatus =
      status === "all" ||
      post.status === status;

    return matchesKeyword && matchesStatus;
  });

  return (
    <>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold">
              商品名・店舗名で検索
            </label>

            <input
              type="text"
              value={keyword}
              onChange={(e) =>
                setKeyword(e.target.value)
              }
              placeholder="例：30th、GEO"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              販売状況
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
            >
              <option value="all">
                すべて
              </option>

              <option value="in_stock">
                販売中
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
      </div>

      <p className="mb-4 text-sm text-gray-500">
        {filteredPosts.length}件の販売情報
      </p>

      <div className="space-y-4">
        {filteredPosts.map((post) => {
          const sourcePost =
            post.source_post;

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {post.product_name ??
                      "商品名不明"}
                  </h2>

                  <p className="mt-1 text-gray-600">
                    {post.store_name ??
                      "店舗不明"}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                    statusStyle[
                      post.status
                    ] ??
                    statusStyle.unknown
                  }`}
                >
                  {statusLabel[
                    post.status
                  ] ?? "状況不明"}
                </span>
              </div>

              {sourcePost?.post_text && (
                <p className="mt-5 whitespace-pre-wrap text-gray-700">
                  {sourcePost.post_text}
                </p>
              )}

              <div className="mt-5 border-t border-gray-100 pt-4">
                {sourcePost?.posted_at && (
                  <p className="text-sm text-gray-500">
                    投稿日時：
                    {new Date(
                      sourcePost.posted_at
                    ).toLocaleString(
                      "ja-JP"
                    )}
                  </p>
                )}

                {sourcePost?.author_name && (
                  <p className="mt-1 text-sm text-gray-500">
                    投稿者：
                    {sourcePost.author_name}

                    {sourcePost.author_username &&
                      ` (@${sourcePost.author_username})`}
                  </p>
                )}

                <div className="mt-3 flex gap-4">
                  <Link
                    href={`/sales/${post.id}`}
                    className="text-sm font-bold text-gray-900 hover:underline"
                  >
                    詳細を見る →
                  </Link>

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
        })}

        {filteredPosts.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            条件に一致する販売情報がありません。
          </div>
        )}
      </div>
    </>
  );
}