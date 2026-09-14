export interface ThreadsFeedResponse {
  data: {
    feedData: {
      edges: ThreadsFeedEdge[];
      page_info?: ThreadsPageInfo;
    };
  };
}

export interface ThreadsFeedEdge {
  node: ThreadsFeedNode;
  cursor: string | null;
}

export interface ThreadsFeedNode {
  text_post_app_thread: ThreadsThread;
  suggested_users: unknown | null;
  __typename: "XDTFeedItem";
}

export interface ThreadsThread {
  thread_header_context: unknown | null;
  thread_items: ThreadsThreadItem[];
  thread_type: string;
  id: string;
}

export interface ThreadsThreadItem {
  post: ThreadsPost;
  parent_post_unavailable_reason: string | null;
  __typename: "XDTThreadItem";
}

export interface ThreadsPost {
  pk: string;
  user: ThreadsUser;
  text_app_info: ThreadsTextAppInfo;
  id: string;
  logging_info_token: string;
  is_paid_partnership: boolean | null;
  audio: unknown | null;
  caption: ThreadsCaption;
  caption_is_edited: boolean;
  transcription_data: unknown | null;
  carousel_media: unknown | null;
  code: string;
  image_versions2: ThreadsImageVersions;
  original_height: number;
  original_width: number;
  accessibility_caption: string | null;
  usertags: unknown | null;
  is_dash_eligible: number | null;
  number_of_qualities: number | null;
  video_dash_manifest: string | null;
  video_versions: ThreadsVideoVersion[] | null;
  has_audio: boolean | null;
  media_type: number;
  caption_add_on: unknown | null;
  text_app_music_info: unknown | null;
  fbid: string;
  has_liked: boolean;
  like_count: number;
  taken_at: number;
  sharing_friction_info: ThreadsSharingFrictionInfo;
  canonical_url: string | null;
  has_viewer_saved: boolean | null;
  giphy_media_info: unknown | null;
  text_app_glimmer_post_info: unknown | null;
  original_lang_for_translations: string | null;
  detected_language: string | null;
  metaPlace: unknown | null;
  meta_place: unknown | null;
  gen_ai_detection_method: ThreadsGenAiDetectionMethod;
  audience: unknown | null;
  organic_tracking_token: string;
  __token: string;
  triage_comments: ThreadsTriageComments;
  seo_ocr_for_related_post: unknown | null;
  seo_transcript_for_related_post: unknown | null;
  like_and_view_counts_disabled: boolean;
}

export interface ThreadsUser {
  friendship_status: ThreadsFriendshipStatus;
  id: string;
  pk: string;
  text_app_last_visited_time: number;
  profile_pic_url: string;
  username: string;
  is_meta_ai_bot: boolean;
  interop_messaging_user_fbid: string;
  full_name: string;
  transparency_label: string | null;
  transparency_product: string | null;
  transparency_product_enabled: boolean;
  is_verified: boolean;
  has_onboarded_to_text_post_app: boolean;
  text_post_app_is_private: boolean;
}

export interface ThreadsFriendshipStatus {
  muting: boolean;
  following: boolean;
  followed_by: boolean;
  outgoing_request: boolean;
  blocking: boolean;
}

export interface ThreadsTextAppInfo {
  is_post_unavailable: boolean;
  pinned_post_info: ThreadsPinnedPostInfo;
  id: string;
  share_info: ThreadsShareInfo;
  show_header_follow: boolean;
  is_ghost_post: boolean;
  self_thread_info: ThreadsSelfThreadInfo;
  is_spoiler_media: boolean;
  tappable_elements: unknown[];
  is_markup: boolean;
  special_effects_enabled_str: string;
  reply_control: string;
  tag_header: ThreadsTagHeader | null;
  direct_reply_count: number;
  has_viewer_replied: boolean;
  self_thread_count: number;
  is_reply: boolean;
  post_author_reachability_status: string | null;
  can_reply: boolean;
  gen_ai_reply_bot_on_media_deny_reason: string;
  ghost_post_exp_time_ms: number | null;
  ghost_post_approximate_like_count_str: string | null;
  ghost_post_reply_type: string | null;
  ghost_post_approximate_reply_count_str: string;
  repost_count: number;
  quote_count: number;
  reshare_count: number;
  can_private_reply: boolean;
  attachment_tombstone_info: unknown | null;
  custom_feed_preview_info: unknown | null;
  platform_podcast_episode_info: unknown | null;
  platform_podcast_info: unknown | null;
  link_preview_attachment: unknown | null;
  link_preview_response: unknown | null;
  linked_inline_media: unknown | null;
  snippet_attachment_info: unknown | null;
  game_score_share_info: unknown | null;
  public_view_count_card_attachment_info: unknown | null;
  community_emoji_update_attachment_info: unknown | null;
  community_entity_card_info: unknown | null;
  scorecard_attachment_info: unknown | null;
  sport_team_allegiance_card_attachment_info: unknown | null;
  algo_tweaks_info: unknown | null;
  text_fragments: ThreadsTextFragments;
  reply_to_author: ThreadsUser | null;
  reply_approval_info: ThreadsReplyApprovalInfo;
  hush_info: unknown | null;
  system_status_message: string | null;
  root_post_author: ThreadsUser | null;
  private_reply_partner: ThreadsPrivateReplyPartner | null;
  fediverse_info: ThreadsFediverseInfo;
  author_context_pill: unknown | null;
  is_liked_by_root_author: boolean;
  related_trends_info: unknown | null;
  post_unavailable_reason: string | null;
  post_tombstone_info: unknown | null;
}

export interface ThreadsPinnedPostInfo {
  is_pinned_to_profile: boolean;
  is_pinned_to_parent_post: boolean;
}

export interface ThreadsShareInfo {
  reposted_post: ThreadsPost | null;
  is_reposted_by_viewer: boolean;
  can_quote_post: boolean;
  quoted_attachment_author_attribution_allowed: boolean;
  quoted_attachment_post_unavailable: boolean;
  quoted_attachment_post: ThreadsPost | null;
  quoted_post: ThreadsPost | null;
}

export interface ThreadsSelfThreadInfo {
  self_thread_length: number;
  id: string;
  post_position_in_self_thread: number;
}

export interface ThreadsTagHeader {
  display_name: string;
  id: string;
  is_community: boolean;
  tag_cluster_name: string;
  community_emoji: string | null;
}

export interface ThreadsTextFragments {
  fragments: ThreadsTextFragment[];
}

export interface ThreadsTextFragment {
  fragment_type: string;
  link_fragment: unknown | null;
  mention_fragment: unknown | null;
  plaintext: string;
  inline_sticker_fragment: unknown | null;
  linkified_web_url: string | null;
  linkified_in_app_url: string | null;
  styling_info: unknown | null;
}

export interface ThreadsReplyApprovalInfo {
  pending_reply_status: string | null;
  pending_reply_count: number | null;
  ignored_reply_count: number | null;
}

export interface ThreadsPrivateReplyPartner {
  username: string;
  id: string;
}

export interface ThreadsFediverseInfo {
  is_federated: boolean;
  enqueued_for_federation: boolean;
  federated_like_count: number | null;
}

export interface ThreadsCaption {
  text: string;
  has_translation: boolean | null;
  pk: string;
  text_translation: string | null;
}

export interface ThreadsImageVersions {
  candidates: ThreadsImageCandidate[];
}

export interface ThreadsImageCandidate {
  height: number;
  width: number;
  url: string;
}

export interface ThreadsVideoVersion {
  type?: number;
  url?: string;
  width?: number;
  height?: number;
  id?: string;
  [key: string]: unknown;
}

export interface ThreadsSharingFrictionInfo {
  should_have_sharing_friction: boolean;
  sharing_friction_payload: string | null;
}

export interface ThreadsGenAiDetectionMethod {
  detection_method: string;
}

export interface ThreadsTriageComments {
  count_up_to: number;
}

export interface ThreadsPageInfo {
  has_next_page?: boolean;
  has_previous_page?: boolean;
  start_cursor?: string | null;
  end_cursor?: string | null;
}
