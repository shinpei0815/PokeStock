import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SalesDetailPage({ params }: Props) {
  const { id } = await params;

  const { data, error } = await supabase
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
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const sourcePost = Array.isArray(data.source_post)
    ? data.source_post[0] ?? null
    : data.source_post ?? null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-bold text-blue-600 hover:underline"
        >
          ← 一覧に戻る
        </Link>

        <article className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                {data.product_name ?? "商品名不明"}
              </h1>

              <p className="mt-2 text-lg text-gray-600">
                {data.store_name ?? "店舗不明"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                statusStyle[data.status] ??
                statusStyle.unknown
              }`}
            >
              {statusLabel[data.status] ?? "状況不明"}
            </span>
          </div>

          {sourcePost?.post_text && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-gray-500">
                X投稿内容
              </h2>

              <p className="mt-2 whitespace-pre-wrap text-lg">
                {sourcePost.post_text}
              </p>
            </div>
          )}

          <div className="mt-8 space-y-3 border-t border-gray-200 pt-6 text-sm text-gray-600">
            {sourcePost?.posted_at && (
              <p>
                投稿日時：
                <span className="ml-2 text-gray-900">
                  {new Date(
                    sourcePost.posted_at
                  ).toLocaleString("ja-JP")}
                </span>
              </p>
            )}

            {sourcePost?.author_name && (
              <p>
                投稿者：
                <span className="ml-2 text-gray-900">
                  {sourcePost.author_name}

                  {sourcePost.author_username &&
                    ` (@${sourcePost.author_username})`}
                </span>
              </p>
            )}

            <p>
              解析信頼度：
              <span className="ml-2 text-gray-900">
                {data.confidence != null
                  ? `${Math.round(data.confidence * 100)}%`
                  : "不明"}
              </span>
            </p>

            <p>
              PokeStock登録日時：
              <span className="ml-2 text-gray-900">
                {new Date(data.created_at).toLocaleString(
                  "ja-JP"
                )}
              </span>
            </p>

            {sourcePost?.x_post_id && (
              <p>
                X投稿ID：
                <span className="ml-2 text-gray-900">
                  {sourcePost.x_post_id}
                </span>
              </p>
            )}
          </div>

          {sourcePost?.post_url && (
            <a
              href={sourcePost.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-lg bg-black px-5 py-3 font-bold text-white hover:bg-gray-800"
            >
              Xの元投稿を見る
            </a>
          )}
        </article>
      </div>
    </main>
  );
}