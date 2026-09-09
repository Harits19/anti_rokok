import { env } from "../../config/env";
import { serviceUnavailable } from "../../shared/errors";
import { Logger } from "../../shared/logger";


export async function publishText(text: string) {
  try {
    const { id } = await createPost(text);
    await publish({ id, withDelay: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw serviceUnavailable(`Gagal publish ke Threads: ${message}`);
  }
}


export async function startKeywordSearch() {
  const logger = new Logger(startKeywordSearch);
  logger.info("Keyword search started");
  let index = 0;
  while (true) {
    logger.info(`Keyword search attempt since service on ${index}`);
    const start = Date.now();

    try {
      await searchThreadsByKeyword('krakatau');
    } catch (error) {
      logger.error('Keyword search failed:', error);
    }

    const duration = Date.now() - start;

    const searchInterval = 5 * 60 * 1000;

    const delay = Math.max(
      0,
      searchInterval - duration,
    );

    console.log(
      `Next keyword search in ${delay / 1000}s`,
    );

    await new Promise(resolve =>
      setTimeout(resolve, delay),
    );
    index++;
  }
}


export async function searchThreadsByKeyword(keyword: string) {
  const logger = new Logger(searchThreadsByKeyword);
  const params = new URLSearchParams({
    q: keyword,
    search_type: 'TOP',
    fields: [
      'id',
      'text',
      'media_type',
      'permalink',
      'timestamp',
      'username',
      'has_replies',
      'is_quote_post',
      'is_reply',
    ].join(','),
  });

  const option = {
    path: `/keyword_search`,
    method: 'GET',
    params,

  } as const;

  logger.info(`searching keyword with option`, option);

  const response = await threadsFetch(
    option
  );

  logger.info(`search threads by keyword: `, response);

}

async function createPost(text: string): Promise<{ id: string }> {
  const logger = new Logger(createPost);
  const userId = env.THREADS_BOT_USER_ID;

  const result = await threadsFetch<{ id: string }>(
    {
      path: `/${userId}/threads`,
      method: 'POST',
      body: {
        media_type: 'TEXT',
        text,
      },
    }
  );

  logger.info(`Threads post container created: ${result.id}`);

  return result;
}

async function publish({ id, withDelay = false }: { id: string, withDelay?: boolean }): Promise<{ id: string }> {
  const logger = new Logger(publish);

  if (withDelay) {
    await new Promise((resolve) => setTimeout(resolve, 30_000))
  }
  const userId = env.THREADS_BOT_USER_ID;

  const result = await threadsFetch<{ id: string }>(
    {
      path: `/${userId}/threads_publish`,
      method: 'POST',
      body: {
        creation_id: id,
      },
    }
  );

  logger.info(`Threads post published: ${result.id}`);

  return result;
}


async function threadsFetch<T>(
  { body, path, method, params }: {
    path: string,
    body?: Record<string, string>,
    params?: URLSearchParams,
    method: 'POST' | 'GET'
  }
): Promise<T> {

  const logger = new Logger(threadsFetch);
  const baseURL = 'https://graph.threads.com/v1.0';

  const accessToken = env.THREADS_BOT_ACCESS_TOKEN;

  if (method === 'GET' && params) {
    logger.info('set access token on params');
    params.append('access_token', accessToken);
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : new URLSearchParams({
      ...body,
      access_token: accessToken,
    }),
  } as const;

  let finalURL = `${baseURL}${path}`;

  if (params) {
    finalURL = `${finalURL}?${params.toString()}`
  }

  logger.info(`try to hit api with url ${finalURL} and option`, options)

  const response = await fetch(finalURL, options);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Threads API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}
