import crypto from "node:crypto";
import { env } from "../../config/env";
import type { ThreadsFeedResponse } from "./model";

export class ThreadsClient {
  private readonly baseUrl = "https://www.threads.com/graphql/query";

  constructor() {}

  async feed() {
    const response = await fetch("https://www.threads.com/graphql/query", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7",
        "content-type": "application/x-www-form-urlencoded",
        priority: "u=1, i",
        "x-asbd-id": "359341",
        "x-bloks-version-id":
          "03cc45721a9d9734bea72949f1cb37f26f2b977d75732de17ea4de385592f106",
        "x-csrftoken": env.THREADS_CSRF_TOKEN,
        "x-fb-friendly-name": "BarcelonaFeedDirectQuery",
        "x-fb-lsd": env.THREADS_LSD,
        "x-ig-app-id": "238260118697367",
        "x-root-field-name":
          "xdt_api__v1__feed__text_post_app_timeline__connection",
        "x-web-session-id": "mcv43v:l6oc23:pfimp4",
        cookie: env.THREADS_COOKIE,
        Referer: "https://www.threads.com/",
      },
      body: "av=17841463428950979&__user=0&__a=1&__req=p&__hs=20710.HYP%3Abarcelona_web_pkg.2.1...0&dpr=2&__ccg=UNKNOWN&__rev=1047443260&__s=mcv43v%3Al6oc23%3Apfimp4&__hsi=7685343041602107360&__dyn=7xeUmwlEnwn8K2Wmh0no6u5U4e0yoW3q32360CEbo1nEhw2nVE4W0qa0FE2awgo9oO0n24oaEd82lwv89k2C1Fwc60D85m1mzXwae4UaEW0Loco5G0zK5o4q0HU420n6azo7u0zE2ZwrUK2K2WE15E6O1FwCxC5E8o4J08q2K7E4u48jgbVE5C0C85O1xwu80C23m&__csr=ggOjqW9kZN5bOaJHjFnrTtvqLVynGhkRgWqJu5qy98yUGn-qucAh8HDXypQF6O9lzFpUACh4ZU8ohxK2CbyoeFEdo9o9SnxeSWpputobA1tBwFwHht5VQ9oOq00po-12w2zE0lmpUF38x00Kvw2-Ulg1mE6K0I9yo3OU9podp80mvoSYU1chsm6Aq1pg5ucxAnet2bCg3pxie5Sb_uVAcwmFpUmAzE0lyw8OiifNg&__hsdp=h218xB40R81i2ErNOdNi3x0u1opwD1eCi8g8rGrR1QTqH5wlO3xel58AaBh0gQgkF2yVp18x19a9wWxhwx2kA6FHBbg0yVwumaoaE3_w4Rgco0r4w1uPw3uo08Ao&__hblp=02wo22wtQ0x9oC4o5-E23w5QwbG0y8b82Yw5My81OU1RE0Re04zE2Ewbu09SwdK48kwiU3xwd60N8aE17o7S1HwWw6Fwpo4u0-EK&__sjsp=h218xxMcM3gw9wpwD1eCi8g8pFLl86PpGNo5tzXgGoygd43gi8g71w&__comet_req=29&fb_dtsg=NAfznt2SnrYYAQIrYpcEROg439Hjg-uKjr3eP4pNh0SLIjY2zJ7XUMA%3A17864970403026470%3A1782785210&jazoest=26182&lsd=x4W9v8i_rINd1jTUFRHb-b&__spin_r=1047443260&__spin_b=trunk&__spin_t=1789383367&__crn=comet.threads.BarcelonaHomeRouteV2&qpl_active_flow_ids=236464097&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=BarcelonaFeedDirectQuery&server_timestamps=true&variables=%7B%22data%22%3A%7B%22pagination_source%22%3A%22text_post_feed_threads%22%2C%22reason%22%3A%22cold_start_fetch%22%7D%2C%22variant%22%3A%22for_you%22%2C%22__relay_internal__pv__BarcelonaIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasMetaAiContentAttachmentsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasEventBadgerelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasMusicrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasMessagingrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaIsCrawlerrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaIsInternalUserrelayprovider%22%3Afalse%7D&doc_id=28427931060136602&fb_api_analytics_tags=%5B%22qpl_active_flow_ids%3D236464097%22%5D",
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Threads request failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = (await response.json()) as ThreadsFeedResponse;

    const captions = await result.data.feedData.edges.map(
      (item) =>
        item.node.text_post_app_thread.thread_items[0]?.post.caption.text,
    );
    return captions;
  }
}

export const threadsClient = new ThreadsClient();
