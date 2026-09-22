import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getAgeMinutes(postedAt: string | null) {
  if (!postedAt) {
    return null;
  }

  const postedTime = new Date(postedAt).getTime();

  if (Number.isNaN(postedTime)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - postedTime) / 1000 / 60
    )
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

  const hours =
    Math.floor(ageMinutes / 60);

  if (hours < 24) {
    return `${hours}時間前`;
  }

  const days =
    Math.floor(hours / 24);

  return `${days}日前`;
}

function getFreshness(
  ageMinutes: number | null
) {
  if (ageMinutes === null) {
    return {
      label: "時刻不明",
      className:
        "bg-gray-100 text-gray-600",
    };
  }

  if (ageMinutes <= 60) {
    return {
      label: "新しい情報",
      className:
        "bg-green-100 text-green-700",
    };
  }

  if (ageMinutes <= 180) {
    return {
      label: "少し前の情報",
      className:
        "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "情報が古い可能性あり",
    className:
      "bg-gray-200 text-gray-600",
  };
}

function getDisplayStatus(
  status: string,
  ageMinutes: number | null
) {
  if (status === "sold_out") {
    return {
      label: "完売",
      className:
        "bg-red-100 text-red-700",
    };
  }

  if (status === "low_stock") {
    return {
      label: "残りわずか",
      className:
        "bg-yellow-100 text-yellow-700",
    };
  }

  if (status === "lottery") {
    return {
      label: "抽選受付中",
      className:
        "bg-blue-100 text-blue-700",
    };
  }

  if (status !== "in_stock") {
    return {
      label: "状況不明",
      className:
        "bg-gray-100 text-gray-700",
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

export default async function SaleDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const saleId = Number(id);

  if (
    !Number.isInteger(saleId) ||
    saleId <= 0
  ) {
    notFound();
  }

  const {
    data,
    error,
  } = await supabase
    .from("sale_items")
    .select(`
      id,
      product_name,
      store_name,
      status,
      confidence,
      created_at,
      source_post:x_posts!sale_items_source_post_id_fkey (
        id,
        x_post_id,
        post_text,
        post_url,
        posted_at,
        author_name,
        author_username
      )
    `)
    .eq("id", saleId)
    .single();

  if (error || !data) {
    notFound();
  }

  const sourcePost =
    Array.isArray(data.source_post)
      ? data.source_post[0] ?? null
      : data.source_post ?? null;

  const ageMinutes =
    getAgeMinutes(
      sourcePost?.posted_at ?? null
    );

  const freshness =
    getFreshness(ageMinutes);

  const displayStatus =
    getDisplayStatus(
      data.status,
      ageMinutes
    );

  const confidencePercent =
    data.confidence === null
      ? null
      : Math.round(
          data.confidence * 100
        );

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* 戻る */}
        <Link
          href="/"
          className="text-sm font-bold text-blue-600 hover:underline"
        >
          ← 販売情報一覧へ戻る
        </Link>

        {/* メインカード */}
        <article className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* ヘッダー */}
          <div className="border-b border-gray-100 p-5 sm:p-7">
            <p className="text-xs font-bold text-gray-500 sm:text-sm">
              商品
            </p>

            <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">
              {data.product_name ??
                "商品名不明"}
            </h1>

            <div className="mt-5">
              <p className="text-xs font-bold text-gray-500 sm:text-sm">
                店舗
              </p>

              <p className="mt-1 break-words text-lg font-bold text-gray-800 sm:text-xl">
                {data.store_name ??
                  "店舗不明"}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${displayStatus.className}`}
              >
                {displayStatus.label}
              </span>

              <span
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${freshness.className}`}
              >
                {freshness.label}
              </span>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              ※販売状況はX投稿時点の情報です。
              最新状況は元投稿や店舗情報もご確認ください。
            </p>
          </div>

          {/* X投稿 */}
          {sourcePost && (
            <section className="p-5 sm:p-7">
              <h2 className="text-lg font-bold">
                元のX投稿
              </h2>

              {sourcePost.post_text && (
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 sm:text-base">
                    {sourcePost.post_text}
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-2 text-sm text-gray-600">
                {sourcePost.posted_at && (
                  <>
                    <p className="font-bold text-gray-800">
                      {getRelativeTime(
                        ageMinutes
                      )}
                    </p>

                    <p>
                      投稿日時：
                      {new Date(
                        sourcePost.posted_at
                      ).toLocaleString(
                        "ja-JP",
                        {
                          timeZone:
                            "Asia/Tokyo",
                        }
                      )}
                    </p>
                  </>
                )}

                {sourcePost.author_name && (
                  <p className="break-words">
                    投稿者：
                    {
                      sourcePost.author_name
                    }

                    {sourcePost.author_username &&
                      ` (@${sourcePost.author_username})`}
                  </p>
                )}
              </div>

              {sourcePost.post_url && (
                <a
                  href={
                    sourcePost.post_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition hover:opacity-80"
                >
                  Xの元投稿を見る →
                </a>
              )}
            </section>
          )}

          {/* PokeStock情報 */}
          <section className="border-t border-gray-100 bg-gray-50 p-5 sm:p-7">
            <h2 className="text-lg font-bold">
              PokeStock解析情報
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs font-bold text-gray-500">
                  解析信頼度
                </p>

                <p className="mt-1 text-lg font-bold">
                  {confidencePercent !==
                  null
                    ? `${confidencePercent}%`
                    : "不明"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="text-xs font-bold text-gray-500">
                  PokeStock登録日時
                </p>

                <p className="mt-1 text-sm font-bold">
                  {new Date(
                    data.created_at
                  ).toLocaleString(
                    "ja-JP",
                    {
                      timeZone:
                        "Asia/Tokyo",
                    }
                  )}
                </p>
              </div>

              {sourcePost?.x_post_id && (
                <div className="rounded-xl bg-white p-4 sm:col-span-2">
                  <p className="text-xs font-bold text-gray-500">
                    X投稿ID
                  </p>

                  <p className="mt-1 break-all text-sm font-bold">
                    {
                      sourcePost.x_post_id
                    }
                  </p>
                </div>
              )}
            </div>
          </section>
        </article>

        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            ← 販売情報一覧へ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}