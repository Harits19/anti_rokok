import { test, expect } from "bun:test";
import {
  parsePostHref,
  parseCount,
  isLikedFromLabel,
  dedupeRawRows,
  type RawPostRow,
} from "../src/modules/threads/ui/feed";

function row(over: Partial<RawPostRow> & { href: string }): RawPostRow {
  return {
    author: "",
    postedAt: "",
    text: "",
    likeButtonText: "",
    replyButtonText: "",
    repostButtonText: "",
    ...over,
  };
}

test("parsePostHref menerima bentuk href Threads yang umum", () => {
  expect(parsePostHref("/@clefy_theartganta/post/DeIvUsBE5lZ")).toEqual({
    postId: "DeIvUsBE5lZ",
    permalink: "https://www.threads.com/@clefy_theartganta/post/DeIvUsBE5lZ",
    author: "clefy_theartganta",
  });
});

test("parsePostHref menormalkan href /media ke post yang sama", () => {
  const a = parsePostHref("/@about.foodstories/post/Ddq6N39E6un/media");
  expect(a?.postId).toBe("Ddq6N39E6un");
  expect(a?.permalink).toBe("https://www.threads.com/@about.foodstories/post/Ddq6N39E6un");
});

test("parsePostHref menolak non-post", () => {
  expect(parsePostHref("/search?q=rokok")).toBeNull();
  expect(parsePostHref("")).toBeNull();
  expect(parsePostHref("/@user")).toBeNull();
  expect(parsePostHref("https://help.instagram.com/123")).toBeNull();
});

test("parseCount membaca angka id-ID, singkatan rb/jt, dan kosong", () => {
  expect(parseCount("Suka857")).toBe(857);
  expect(parseCount("Suka1.234")).toBe(1234);
  expect(parseCount("Balas14,8 rb")).toBe(14800);
  expect(parseCount("Posting ulang2 jt")).toBe(2000000);
  expect(parseCount("")).toBe(0);
  expect(parseCount("Balas")).toBe(0);
});

test("isLikedFromLabel mendeteksi post yang sudah di-like", () => {
  expect(isLikedFromLabel("Suka857")).toBe(false);
  expect(isLikedFromLabel("Batal suka857")).toBe(true);
  expect(isLikedFromLabel("Unlike12")).toBe(true);
});

test("dedupeRawRows buang duplikat dan baris tak valid", () => {
  const posts = dedupeRawRows([
    row({
      href: "/@a/post/AAA",
      author: "a",
      postedAt: "2 hari",
      text: "Ini teks rokok pertama",
      likeButtonText: "Suka1.234",
      replyButtonText: "Balas12",
      repostButtonText: "Posting ulang3",
    }),
    row({ href: "/@a/post/AAA/media", text: "duplikat" }),
    row({ href: "/@b/post/BBB", author: "b", text: "Teks kedua", likeButtonText: "Batal suka5" }),
    row({ href: "/search?q=rokok" }),
  ]);

  expect(posts.length).toBe(2);
  expect(posts.map((p) => p.postId)).toEqual(["AAA", "BBB"]);

  expect(posts[0]).toMatchObject({
    author: "a",
    postedAt: "2 hari",
    text: "Ini teks rokok pertama",
    likeCount: 1234,
    replyCount: 12,
    repostCount: 3,
    hasLiked: false,
  });
  expect(posts[1]).toMatchObject({ likeCount: 5, hasLiked: true });
});
