export type UiActionKind = "post" | "reply" | "like" | "repost";

export type ActionStatus = "planned" | "done" | "failed" | "skipped";

export interface ActionResult {
  kind: UiActionKind;
  status: ActionStatus;
  /** Post id Threads kalau ada. */
  targetId?: string;
  permalink?: string;
  /** Pesan singkat; alasan kalau status skipped/failed. */
  message?: string;
  error?: string;
  /** Bukti visual saat aksi dijalankan. */
  screenshot?: string;
}

export interface ScrapedPost {
  postId: string;
  permalink: string;
  author: string;
  text: string;
  /** Tanggal seperti ditampilkan UI (mis. "27/09/2026" atau "2 hari"). */
  postedAt: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  /** true kalau tombol like sudah berubah jadi "Batal suka"/"Unlike". */
  hasLiked: boolean;
  scrapedAt: number;
}
