import { supabase } from "@/lib/supabase";
import SalesList from "@/components/SalesList";

export const dynamic = "force-dynamic";

export default async function Home() {
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
    `);

  if (error) {
    console.error(error);

    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-5xl p-6">
          <h1 className="text-3xl font-bold">
            PokeStock
          </h1>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            販売情報の取得に失敗しました。
          </div>
        </div>
      </main>
    );
  }

  const normalizedData = (data ?? []).map((item) => ({
    id: item.id,
    product_name: item.product_name,
    store_name: item.store_name,
    status: item.status,
    confidence: item.confidence,
    created_at: item.created_at,

    source_post: Array.isArray(item.source_post)
      ? item.source_post[0] ?? null
      : item.source_post ?? null,
  }));

  // Xの投稿日時が新しい順
  const sortedData = normalizedData.sort((a, b) => {
    const aTime = a.source_post?.posted_at
      ? new Date(a.source_post.posted_at).getTime()
      : 0;

    const bTime = b.source_post?.posted_at
      ? new Date(b.source_post.posted_at).getTime()
      : 0;

    return bTime - aTime;
  });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            PokeStock
          </h1>

          <p className="mt-2 text-gray-600">
            ポケモンカードの販売・再入荷情報をチェック
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Xの投稿をもとに、24時間以内の販売情報を表示しています。
          </p>
        </div>

        <SalesList posts={sortedData} />
      </div>
    </main>
  );
}