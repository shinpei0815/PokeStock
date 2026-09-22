import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseSalePost } from "@/lib/parseSalePost";

export async function POST(request: Request) {
  // --------------------------------
  // ① CRON_SECRETで保護
  // --------------------------------

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      {
        error: "CRON_SECRET が設定されていません",
      },
      {
        status: 500,
      }
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  // --------------------------------
  // ② 保存済みx_postsを取得
  // --------------------------------

  const {
    data: xPosts,
    error: xPostsError,
  } = await supabaseAdmin
    .from("x_posts")
    .select(`
      id,
      x_post_id,
      post_text,
      author_name,
      author_username
    `)
    .order("posted_at", {
      ascending: false,
    });

  if (xPostsError) {
    return NextResponse.json(
      {
        error:
          "x_postsの取得に失敗しました",
        details:
          xPostsError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!xPosts || xPosts.length === 0) {
    return NextResponse.json({
      analyzed_posts: 0,
      sale_items_created: 0,
      message:
        "再解析するX投稿がありません",
    });
  }

  // --------------------------------
  // ③ 各投稿を再解析
  // --------------------------------

  const saleItemsForSave = [];

  const analyzedResults = [];

  for (const xPost of xPosts) {
    const parsed = parseSalePost(
      xPost.post_text,
      xPost.author_name,
      xPost.author_username
    );

    analyzedResults.push({
      x_post_id:
        xPost.x_post_id,

      author_name:
        xPost.author_name,

      ...parsed,
    });

    // 店舗が取れない
    if (!parsed.storeName) {
      continue;
    }

    // 商品が取れない
    if (
      parsed.products.length === 0
    ) {
      continue;
    }

    // 状況不明
    if (
      parsed.status === "unknown"
    ) {
      continue;
    }

    for (
      const productName of
        parsed.products
    ) {
      saleItemsForSave.push({
        source_post_id:
          xPost.id,

        product_name:
          productName,

        store_name:
          parsed.storeName,

        status:
          parsed.status,

        confidence:
          Number(
            parsed.confidence.toFixed(
              3
            )
          ),
      });
    }
  }

  // --------------------------------
  // ④ sale_itemsへ保存
  // --------------------------------

  if (
    saleItemsForSave.length > 0
  ) {
    const {
      error: saleItemsError,
    } = await supabaseAdmin
      .from("sale_items")
      .upsert(
        saleItemsForSave,
        {
          onConflict:
            "source_post_id,product_name,store_name",

          ignoreDuplicates:
            true,
        }
      );

    if (saleItemsError) {
      return NextResponse.json(
        {
          error:
            "sale_itemsへの保存に失敗しました",

          details:
            saleItemsError.message,
        },
        {
          status: 500,
        }
      );
    }
  }

  // --------------------------------
  // ⑤ 結果
  // --------------------------------

  return NextResponse.json({
    analyzed_posts:
      xPosts.length,

    sale_items_created:
      saleItemsForSave.length,

    results:
      analyzedResults,
  });
}