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
      body: `av=17841463428950979&__user=0&__a=1&__req=p&__hs=20710.HYP%3Abarcelona_web_pkg.2.1...0&dpr=2&__ccg=UNKNOWN&__rev=1047443260&__s=mcv43v%3Al6oc23%3Apfimp4&__hsi=7685343041602107360&__dyn=7xeUmwlEnwn8K2Wmh0no6u5U4e0yoW3q32360CEbo1nEhw2nVE4W0qa0FE2awgo9oO0n24oaEd82lwv89k2C1Fwc60D85m1mzXwae4UaEW0Loco5G0zK5o4q0HU420n6azo7u0zE2ZwrUK2K2WE15E6O1FwCxC5E8o4J08q2K7E4u48jgbVE5C0C85O1xwu80C23m&__csr=ggOjqW9kZN5bOaJHjFnrTtvqLVynGhkRgWqJu5qy98yUGn-qucAh8HDXypQF6O9lzFpUACh4ZU8ohxK2CbyoeFEdo9o9SnxeSWpputobA1tBwFwHht5VQ9oOq00po-12w2zE0lmpUF38x00Kvw2-Ulg1mE6K0I9yo3OU9podp80mvoSYU1chsm6Aq1pg5ucxAnet2bCg3pxie5Sb_uVAcwmFpUmAzE0lyw8OiifNg&__hsdp=h218xB40R81i2ErNOdNi3x0u1opwD1eCi8g8rGrR1QTqH5wlO3xel58AaBh0gQgkF2yVp18x19a9wWxhwx2kA6FHBbg0yVwumaoaE3_w4Rgco0r4w1uPw3uo08Ao&__hblp=02wo22wtQ0x9oC4o5-E23w5QwbG0y8b82Yw5My81OU1RE0Re04zE2Ewbu09SwdK48kwiU3xwd60N8aE17o7S1HwWw6Fwpo4u0-EK&__sjsp=h218xxMcM3gw9wpwD1eCi8g8pFLl86PpGNo5tzXgGoygd43gi8g71w&__comet_req=29&fb_dtsg=NAfznt2SnrYYAQIrYpcEROg439Hjg-uKjr3eP4pNh0SLIjY2zJ7XUMA%3A17864970403026470%3A1782785210&jazoest=26182&lsd=${env.THREADS_LSD}&__spin_r=1047443260&__spin_b=trunk&__spin_t=1789383367&__crn=comet.threads.BarcelonaHomeRouteV2&qpl_active_flow_ids=236464097&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=BarcelonaFeedDirectQuery&server_timestamps=true&variables=%7B%22data%22%3A%7B%22pagination_source%22%3A%22text_post_feed_threads%22%2C%22reason%22%3A%22cold_start_fetch%22%7D%2C%22variant%22%3A%22for_you%22%2C%22__relay_internal__pv__BarcelonaIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasMetaAiContentAttachmentsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasEventBadgerelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasMusicrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasMessagingrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaIsCrawlerrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider%22%3Afalse%2C%22__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider%22%3Atrue%2C%22__relay_internal__pv__BarcelonaIsInternalUserrelayprovider%22%3Afalse%7D&doc_id=28427931060136602&fb_api_analytics_tags=%5B%22qpl_active_flow_ids%3D236464097%22%5D`,
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

  async search(keyword: string) {
    const encodedKeyword = encodeURIComponent(keyword);
    const response = await fetch(
      "https://www.threads.com/ajax/route-definition/",
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7",
          "content-type": "application/x-www-form-urlencoded",
          priority: "u=1, i",
          "x-asbd-id": "359341",
          "x-fb-lsd": env.THREADS_LSD,
          cookie: env.THREADS_COOKIE,
          Referer: "https://www.threads.com/search",
        },
        body: `client_previous_actor_id=17841463428950979&route_url=%2Fsearch%3Fq%3D${encodedKeyword}%26serp_type%3Ddefault&routing_namespace=barcelona_web&trace_policy=barcelona.searchPage&__user=0&__a=1&__req=25&__hs=20711.HYP%3Abarcelona_web_pkg.2.1...0&dpr=2&__ccg=UNKNOWN&__rev=1047523314&__s=r37oum%3Aaxmipo%3A3nql6p&__hsi=7685587826014003763&__dyn=7xeUmwlEnwn8yEbFp41twpUnwgU29zEdEc8co2qwJyE2Owa24o0B-q1ew6ywMwto2awgo9oO0n24oaEd82lwv89k2C1Fwc60D85m1mzXwae4UaEW0Loco5G0zK5o4q0HU420n6azo7u0zE2ZwrUK2K2WE15E6O1FwCxC5E8o4J08q2K7E4u8Dxd0LCwWxW7E7C1swoo7y1Sw5lwkE423m&__csr=gjhn2qb2234JNImZN7b95SG9isBOmjjt94HAbTplKTSjvQZfjKZ92X8iq8gyHXBDAj4SRFkgibjJfBV9iz8G7GGQcAhd4HBUGiFoOaGqESq26fyU422m18U4a2e0CA6U6q1jw06j2gaomw2qE1GFbwaG2y0Iomgpgx6w7ZeUG78kyAt03444o0vYAwiEe820yo0AW1ywpEC8hUckrwsQ6o32Dt0d22fw-x52F980mjy5yLN08Q0gGx4k6USEf8jgfE9op5Nh23983hBz8o5QbnN1t38zwiWBDJBoOidw4jyUO9w2cUkyQ0g20O40CXzIlw0HLw0l3E&__hsdp=gvB09Ck1hxS81gMJ1ayvMlMf2C7q4UIy1IMTs6b5BrjA3_YfA720aGA6cE842VwAExg6RsWho4MAN9Mj5j843xww5QrokwCab82UM7kV3yyyk1451t120ZAi0mi0I8y0hy0wU5604eU27w1tu5o7G0hG1swqU7C0wUuwda0oG0iO0s20MU0BXg&__hblp=2k2508a0syag8U-0B9oGex51vgC78dFrDhA7oqxSp5U7ufwzyobokwyxi1hwokdyVkcAwPK1aVUJ0Ux-EW6FokyomyoK5otxm3W2uayQbG11yUowxwbW2q2i3m9Cy8B1h1ybwkE-2C2aE98jyEK9wDAy-68y0C8lwci2y17yofU5i0m-1KwKw77weW04Do52ewdiax2bK7ofE2Bwzg8U6K0_ouwda4o28x622fxa1mwgEy2K0t-0S833w40w8G0QJ0ay18w&__sjsp=gv709Akv7E784t1S81gQwBc24DY5s4Vw9qCc9EjyO86ar3t8Yp3zah6AjA5EH5vMEaA5G1qAAe2R0Ko9a8k1Jm0E45O00kLE&__comet_req=29&fb_dtsg=NAfy6gK91fgcLgWw-mHKzxN-7A3D2qnALRjunwlS0VlxG0k4vsM9gHQ%3A17864970403026470%3A1782785210&jazoest=26221&lsd=${env.THREADS_LSD}&__spin_r=1047523314&__spin_b=trunk&__spin_t=1789440360&__crn=comet.threads.BarcelonaSearchColumnRoute`,
        method: "POST",
      },
    );

    const text = await response.text();
    const jsons = text.split("for (;;);").filter(Boolean);
    const datas: {
      result?: {
        result?: {
          data?: {
            searchResults?: {
              edges?: {
                node?: {
                  thread?: {
                    thread_items?: {
                      post?: {
                        caption?: {
                          text?: string;
                        };
                      };
                    }[];
                  };
                };
              }[];
            };
          };
        };
      };
    }[] = jsons.map((item) => JSON.parse(item));

    // write to json file
    // await Bun.write("output.json", JSON.stringify(datas, null, 2));
    const captions = datas
      .flatMap((item) =>
        item?.result?.result?.data?.searchResults?.edges?.map((edge) =>
          edge?.node?.thread?.thread_items?.map(
            (item) => item.post?.caption?.text,
          ),
        ),
      )
      .flat(2)
      .filter(Boolean);
    return captions;
  }

  async likePost(postId: string) {
    // todo change body with postId
    fetch("https://www.threads.com/graphql/query", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7",
        "content-type": "application/x-www-form-urlencoded",
        priority: "u=1, i",
        "x-asbd-id": "359341",
        "x-bloks-version-id":
          "263bb7b084de88b94490949454ce63c4e3dd00f199215b85147f5da7c8ed1288",
        "x-csrftoken": env.THREADS_CSRF_TOKEN,
        "x-fb-friendly-name":
          "useBarcelonaBatchedDynamicPostCountsSubscriptionQuery",
        "x-fb-lsd": env.THREADS_LSD,
        "x-ig-app-id": "238260118697367",
        "x-root-field-name": "xdt_text_app_posts_batch",
        "x-web-session-id": "wtv6ly:ukspqu:mtbf2a",
        cookie: env.THREADS_COOKIE,
        Referer: "https://www.threads.com/search?q=rokok&serp_type=default",
      },
      // todo change body to readable version sk-Hm9duP2285_oiVBi2ZmhGg
      body: `av=17841463428950979&__user=0&__a=1&__req=2u&__hs=20713.HYP%3Abarcelona_web_pkg.2.1...0&dpr=2&__ccg=UNKNOWN&__rev=1047728823&__s=wtv6ly%3Aukspqu%3Amtbf2a&__hsi=7686442257358690138&__dyn=7xeUmwlEnwn8K2Wmh0no6u5U4e0yoW3q32360CEbo1nEhw2nVE4W0qa0FE2awgo9oO0n24oaEd82lwv89k2C1Fwc60D85m1mzXwae4UaEW0Loco5G0zK5o4q0HU420n6azo7u0zE2ZwrUK2K2WE15E6O1FwCxC5E8o4J0lEbUaUuwhUyu4Q2-q1pw9y1swoo7y0sO1iwg8do&__csr=ghv97E6ASzgH8yN_kAReyLFcviF8wDXQZZfQGWiiiK-i9mDgKAi5pBAlYzsYxjtvQV8KaKZe9Ayuily8KiEgF4KZ4AGmiVVV944EzHzkEoDz8rwiQ0zA0XEem0N82x9Ktu9z9Bwie00p1S2938gDzE0D-cAwAw8G0gy087h8xj0zhQ1-Je09dw0BCg0MFoG8hQ1TxZ0dyaz9S08Ih82eAAAw1jK8ma_40yg3oAd4G5AcyMM7UG1Gxbxy4A9gO9wOwbm2CES9xALN0iCwwEhauS4U7611K049EW9Ada0z7wjo09UU064u&__hsdp=gtAM2e50lvgb0b1asl0LwW6zMBal2zgpmwJMldFjHBN4qbqgwHFE8StP82zb5Pgira666S0gl9NboIkbwA1ct1Uxk6O26m1tkk424r6z2zF24zP0LwDabeh1AUngn51pe0-A2G1rg36g2Cgc412K1zgeE1680nmghg4a09bwfq9wnE3Xwa-0DU8837w5cw2rE6q12w2jC18w&__hblp=2k0yA0ny0wFbxV08CcAzEgg8A21w_qDAJ1e32agO6U5x7wECwwwNzU2iwRxK8yK2S4Ec42258iy8aF8W13DzEhyV8HwwwjUK2G6oiBxym0g27U6q1um7m4Q78422SaxeeyFUJ3awwo4m1AwBxi0uW0o217w6Yw6eAwjo1Godo5u0hm689ES11wVwvUnw9u0DU882vwwCwrU4C8U6O6FUG0gm0VU6S1CwgE14U1eC0g2&__sjsp=gt708UkdhsQlD2Xgf8ZobNq1E5Faskg6pgEA166xslal2zgpmwJMJTi4JFngKky5oLF224FEUJDIOwjoANzgio866S0gqDg3580lF0&__comet_req=29&fb_dtsg=NAfytn1sQCMJKRfFNDynH793VtkhxWiXBIqnLcmMdoikZ_XLCcNr3tg%3A17864970403026470%3A1782785210&jazoest=26453&lsd=${env.THREADS_LSD}&__spin_r=1047728823&__spin_b=trunk&__spin_t=1789639298&__crn=comet.threads.BarcelonaSearchResultsColumnRoute&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=useBarcelonaBatchedDynamicPostCountsSubscriptionQuery&server_timestamps=true&variables=%7B%22post_ids%22%3A%5B%223952293672838739900%22%5D%7D&doc_id=37914959241452836`,
      method: "POST",
    });
  }
}

export const threadsClient = new ThreadsClient();
