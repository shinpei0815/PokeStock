import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseSalePost } from "@/lib/parseSalePost";

type XTweet = {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  edit_history_tweet_ids?: string[];
};

type XUser = {
  id: string;
  name: string;
  username: string;
};

async function stopXFetch(reason: string) {
  await supabaseAdmin
    .from("app_settings")
    .update({
      x_fetch_enabled: false,
      x_fetch_stop_reason: reason,
      x_fetch_stopped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
}

function isCreditError(
  status: number,
  responseData: unknown
) {
  const text = JSON.stringify(responseData).toLowerCase();

  return (
    status === 402 ||
    text.includes("credit") ||
    text.includes("credits") ||
    text.includes("billing") ||
    text.includes("spending limit") ||
    text.includes("usage cap") ||
    text.includes("insufficient balance")
  );
}

export async function GET(request: Request) {
  // --------------------------------
  // ① CRON_SECRET確認
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
  // ② 自動取得ON/OFF確認
  // --------------------------------

  const {
    data: settings,
    error: settingsError,
  } = await supabaseAdmin
    .from("app_settings")
    .select(`
      id,
      x_fetch_enabled,
      x_fetch_stop_reason,
      x_fetch_stopped_at
    `)
    .eq("id", 1)
    .single();

  if (settingsError) {
    return NextResponse.json(
      {
        error:
          "app_settingsの取得に失敗しました",
        details: settingsError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!settings.x_fetch_enabled) {
    return NextResponse.json({
      stopped: true,
      message:
        "X APIの自動取得は停止中です",
      reason:
        settings.x_fetch_stop_reason,
      stopped_at:
        settings.x_fetch_stopped_at,
    });
  }

  // --------------------------------
  // ③ X Bearer Token確認
  // --------------------------------

  const bearerToken =
    process.env.X_BEARER_TOKEN;

  if (!bearerToken) {
    return NextResponse.json(
      {
        error:
          "X_BEARER_TOKEN が設定されていません",
      },
      {
        status: 500,
      }
    );
  }

  // --------------------------------
  // ④ X検索条件
  // --------------------------------

  const query =
    '("ポケモンカード" OR "ポケカ") ' +
    '("再入荷" OR "再販" OR "入荷しました" OR "販売開始" OR "販売中" OR "完売" OR "在庫あり") ' +
    "-is:retweet -is:reply " +
    "-買取 -交換 -メルカリ -ad -オリパ " +
    '-"目撃情報" -"情報まとめ" -"在庫復活" -"買える" -"売ってる" -"キャンセル待ち"';

  const params = new URLSearchParams({
    query,
    "tweet.fields":
      "created_at,author_id",
    max_results: "10",
  });

  // --------------------------------
  // ⑤ X投稿取得
  // --------------------------------

  const response = await fetch(
    `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
    {
      headers: {
        Authorization:
          `Bearer ${bearerToken}`,
      },
      cache: "no-store",
    }
  );

  const xResponse =
    await response.json();

  if (!response.ok) {
    if (
      isCreditError(
        response.status,
        xResponse
      )
    ) {
      await stopXFetch(
        "X APIのクレジット不足または支出上限に達したため自動停止しました"
      );

      return NextResponse.json(
        {
          stopped: true,
          error:
            "X APIのクレジット不足または支出上限を検知しました",
          message:
            "PokeStockのX自動取得をOFFにしました",
          x_response:
            xResponse,
        },
        {
          status:
            response.status,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "X APIの取得に失敗しました",
        x_response:
          xResponse,
      },
      {
        status:
          response.status,
      }
    );
  }

  const tweets: XTweet[] =
    Array.isArray(
      xResponse.data
    )
      ? xResponse.data
      : [];

  // --------------------------------
  // ⑥ PokeStock側フィルター
  // --------------------------------

  const pokemonWords = [
    "ポケカ",
    "ポケモンカード",
  ];

  const salesWords = [
    "販売情報",
    "再販情報",
    "入荷情報",
    "再入荷しました",
    "入荷しました",
    "販売開始",
    "先着販売",
    "販売しております",
    "在庫あり",
    "完売しました",
    "完売いたしました",
  ];

  const excludeWords = [
    "PR",
    "アフィリエイト",
    "ガチャ",
    "オリパ",
    "プレゼント企画",
    "福袋",
    "ポケモン袋",
    "ワンピース",
    "YGO",
    "買いたい",
    "欲しい",
    "再販きたら",
    "再販時に",
    "再販なかった",
    "疑問",
    "なんで",
    "目撃情報",
    "情報まとめ",
    "在庫復活",
    "買える",
    "売ってる",
    "キャンセル待ち",
    "どこも完売",
    "買いに",
    "自引き",
  ];

  const filteredTweets =
    tweets.filter((tweet) => {
      const text =
        tweet.text;

      const hasPokemonWord =
        pokemonWords.some(
          (word) =>
            text.includes(word)
        );

      const hasSalesWord =
        salesWords.some(
          (word) =>
            text.includes(word)
        );

      const hasExcludeWord =
        excludeWords.some(
          (word) =>
            text.includes(word)
        );

      return (
        hasPokemonWord &&
        hasSalesWord &&
        !hasExcludeWord
      );
    });

  // --------------------------------
  // 候補0件なら投稿者APIを呼ばない
  // --------------------------------

  if (
    filteredTweets.length === 0
  ) {
    return NextResponse.json({
      stopped: false,
      original_count:
        tweets.length,
      filtered_count: 0,
      authors_requested: 0,
      x_posts_saved: 0,
      sale_items_saved: 0,
      data: [],
    });
  }

  // --------------------------------
  // ⑦ 必要な投稿者だけ取得
  // --------------------------------

  const authorIds =
    Array.from(
      new Set(
        filteredTweets.map(
          (tweet) =>
            tweet.author_id
        )
      )
    );

  const userParams =
    new URLSearchParams({
      ids:
        authorIds.join(","),
      "user.fields":
        "id,name,username",
    });

  const usersResponse =
    await fetch(
      `https://api.x.com/2/users?${userParams.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${bearerToken}`,
        },
        cache: "no-store",
      }
    );

  const usersXResponse =
    await usersResponse.json();

  if (!usersResponse.ok) {
    if (
      isCreditError(
        usersResponse.status,
        usersXResponse
      )
    ) {
      await stopXFetch(
        "X APIのクレジット不足または支出上限に達したため自動停止しました"
      );

      return NextResponse.json(
        {
          stopped: true,
          error:
            "X APIのクレジット不足または支出上限を検知しました",
          message:
            "PokeStockのX自動取得をOFFにしました",
        },
        {
          status:
            usersResponse.status,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "X投稿者情報の取得に失敗しました",
        x_response:
          usersXResponse,
      },
      {
        status:
          usersResponse.status,
      }
    );
  }

  const users: XUser[] =
    Array.isArray(
      usersXResponse.data
    )
      ? usersXResponse.data
      : [];

  const userMap =
    new Map(
      users.map(
        (user) => [
          user.id,
          user,
        ]
      )
    );

  // --------------------------------
  // ⑧ x_posts保存用データ作成
  // --------------------------------

  const xPostsForSave =
    filteredTweets.map(
      (tweet) => {
        const author =
          userMap.get(
            tweet.author_id
          );

        return {
          x_post_id:
            tweet.id,

          author_id:
            tweet.author_id,

          author_username:
            author?.username ??
            null,

          author_name:
            author?.name ??
            null,

          post_text:
            tweet.text,

          post_url:
            author?.username
              ? `https://x.com/${author.username}/status/${tweet.id}`
              : `https://x.com/i/web/status/${tweet.id}`,

          posted_at:
            tweet.created_at,

          raw_data: {
            tweet,
            author:
              author ?? null,
          },
        };
      }
    );

  // --------------------------------
  // ⑨ x_posts保存
  // --------------------------------

  const {
    data: savedXPosts,
    error: xPostsError,
  } = await supabaseAdmin
    .from("x_posts")
    .upsert(
      xPostsForSave,
      {
        onConflict:
          "x_post_id",
      }
    )
    .select(`
      id,
      x_post_id,
      post_text,
      author_name,
      author_username
    `);

  if (xPostsError) {
    return NextResponse.json(
      {
        error:
          "x_postsへの保存に失敗しました",
        details:
          xPostsError.message,
      },
      {
        status: 500,
      }
    );
  }

  // --------------------------------
  // ⑩ sale_items解析
  // --------------------------------

  const saleItemsForSave = [];

  for (
    const xPost of
      savedXPosts ?? []
  ) {
    const parsed =
      parseSalePost(
        xPost.post_text,
        xPost.author_name,
        xPost.author_username
      );

    // 店舗名が取れない
    if (!parsed.storeName) {
      continue;
    }

    // 商品名が取れない
    if (
      parsed.products.length === 0
    ) {
      continue;
    }

    // 販売状況が不明
    if (
      parsed.status ===
      "unknown"
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
  // ⑪ sale_items保存
  // --------------------------------

  if (
    saleItemsForSave.length > 0
  ) {
    const {
      error:
        saleItemsError,
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

    if (
      saleItemsError
    ) {
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
  // ⑫ 結果確認用データ
  // --------------------------------

  const analyzedData =
    (
      savedXPosts ?? []
    ).map(
      (xPost) => ({
        x_post_id:
          xPost.x_post_id,

        author_name:
          xPost.author_name,

        author_username:
          xPost.author_username,

        ...parseSalePost(
          xPost.post_text,
          xPost.author_name,
          xPost.author_username
        ),
      })
    );

  // --------------------------------
  // ⑬ レスポンス
  // --------------------------------

  return NextResponse.json({
    stopped: false,

    original_count:
      tweets.length,

    filtered_count:
      filteredTweets.length,

    authors_requested:
      authorIds.length,

    x_posts_saved:
      savedXPosts?.length ??
      0,

    sale_items_saved:
      saleItemsForSave.length,

    data:
      analyzedData,
  });
}