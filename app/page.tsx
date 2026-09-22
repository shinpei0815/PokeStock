import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SalesList from "@/components/SalesList";

export const dynamic = "force-dynamic";

function getRelativeTime(dateString: string | null) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMinutes = Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / 1000 / 60
    )
  );

  if (diffMinutes < 1) {
    return "たった今";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }

  const hours = Math.floor(
    diffMinutes / 60
  );

  if (hours < 24) {
    return `${hours}時間前`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days}日前`;
}

export default async function Home() {
  // --------------------------------
  // 販売情報取得
  // --------------------------------

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
    `);

  // --------------------------------
  // 最終X取得時刻
  // app_settingsはRLSで非公開なので
  // サーバー側のsupabaseAdminを使用
  // --------------------------------

  const {
    data: settings,
    error: settingsError,
  } = await supabaseAdmin
    .from("app_settings")
    .select(`
      last_x_fetch_at,
      x_fetch_enabled
    `)
    .eq("id", 1)
    .single();

  if (settingsError) {
    console.error(
      "app_settings取得エラー:",
      settingsError.message
    );
  }

  const lastXFetchAt =
    settings?.last_x_fetch_at ??
    null;

  const relativeFetchTime =
    getRelativeTime(lastXFetchAt);

  // --------------------------------
  // 販売情報取得エラー
  // --------------------------------

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

  // --------------------------------
  // SupabaseのJOIN結果を整形
  // --------------------------------

  const normalizedData = (data ?? []).map(
    (item) => ({
      id: item.id,
      product_name:
        item.product_name,
      store_name:
        item.store_name,
      status:
        item.status,
      confidence:
        item.confidence,
      created_at:
        item.created_at,

      source_post:
        Array.isArray(
          item.source_post
        )
          ? item.source_post[0] ??
            null
          : item.source_post ??
            null,
    })
  );

  // --------------------------------
  // X投稿日時が新しい順
  // --------------------------------

  const sortedData =
    normalizedData.sort(
      (a, b) => {
        const aTime =
          a.source_post
            ?.posted_at
            ? new Date(
                a.source_post.posted_at
              ).getTime()
            : 0;

        const bTime =
          b.source_post
            ?.posted_at
            ? new Date(
                b.source_post.posted_at
              ).getTime()
            : 0;

        return bTime - aTime;
      }
    );

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* タイトル */}
        <div className="mb-5 sm:mb-6">
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

        {/* 更新状況 */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">
                データ更新状況
              </p>

              {lastXFetchAt ? (
                <>
                  <p className="mt-1 text-sm text-gray-600">
                    最終取得：
                    <span className="font-bold text-gray-900">
                      {relativeFetchTime}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(
                      lastXFetchAt
                    ).toLocaleString(
                      "ja-JP",
                      {
                        timeZone:
                          "Asia/Tokyo",
                      }
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  まだ取得履歴がありません。
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <p className="text-sm font-bold text-gray-700">
                6時間ごとに自動更新
              </p>

              {settings?.x_fetch_enabled ===
              false ? (
                <p className="mt-1 text-xs font-bold text-red-600">
                  自動取得停止中
                </p>
              ) : (
                <p className="mt-1 text-xs text-green-700">
                  自動取得稼働中
                </p>
              )}
            </div>
          </div>
        </div>

        <SalesList
          posts={sortedData}
        />
      </div>
    </main>
  );
}