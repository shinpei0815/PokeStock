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
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">
            PokeStock
          </h1>

          <p className="mt-4 text-red-500">
            データ取得エラー: {error.message}
          </p>
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

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold">
            PokeStock
          </h1>

          <p className="mt-2 text-gray-600">
            Xから取得したポケモンカードの販売情報
          </p>
        </header>

        <SalesList posts={normalizedData} />
      </div>
    </main>
  );
}