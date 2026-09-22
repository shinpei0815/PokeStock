import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type XUser = {
  id: string;
  name: string;
  username: string;
};

export async function GET() {
  const bearerToken = process.env.X_BEARER_TOKEN;

  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_BEARER_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  // 投稿者情報がまだ入っていないx_postsを取得
  const { data: posts, error: postsError } =
    await supabaseAdmin
      .from("x_posts")
      .select("id, author_id")
      .or(
        "author_name.is.null,author_username.is.null"
      );

  if (postsError) {
    return NextResponse.json(
      {
        error: "x_postsの取得に失敗しました",
        details: postsError.message,
      },
      { status: 500 }
    );
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({
      message: "更新対象の投稿者はいません",
      updated_count: 0,
    });
  }

  // 同じauthor_idを重複させない
  const authorIds = Array.from(
    new Set(
      posts
        .map((post) => post.author_id)
        .filter(Boolean)
    )
  );

  const params = new URLSearchParams({
    ids: authorIds.join(","),
    "user.fields": "id,name,username",
  });

  const response = await fetch(
    `https://api.x.com/2/users?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
      cache: "no-store",
    }
  );

  const xResponse = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Xのユーザー情報取得に失敗しました",
        x_response: xResponse,
      },
      { status: response.status }
    );
  }

  const users: XUser[] = Array.isArray(xResponse.data)
    ? xResponse.data
    : [];

  let updatedCount = 0;

  for (const user of users) {
    const { error: updateError } =
      await supabaseAdmin
        .from("x_posts")
        .update({
          author_name: user.name,
          author_username: user.username,
        })
        .eq("author_id", user.id);

    if (!updateError) {
      updatedCount++;
    }
  }

  return NextResponse.json({
    requested_authors: authorIds.length,
    found_authors: users.length,
    updated_count: updatedCount,
    users,
  });
}