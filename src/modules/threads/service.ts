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

async function createPost(text: string): Promise<{ id: string }> {
  const logger = new Logger(createPost);

  const result = await threadsFetch<{ id: string }>(
    `/threads`,
    {
      media_type: 'TEXT',
      text,
    },
  );

  logger.info(`Threads post container created: ${result.id}`);

  return result;
}

async function publish({ id, withDelay = false }: { id: string, withDelay?: boolean }): Promise<{ id: string }> {
  const logger = new Logger(publish);

  if (withDelay) {
    await new Promise((resolve) => setTimeout(resolve, 30_000))

  }
  const result = await threadsFetch<{ id: string }>(
    `/threads_publish`,
    {
      creation_id: id,
    },
  );

  logger.info(`Threads post published: ${result.id}`);

  return result;
}


async function threadsFetch<T>(
  path: string,
  body: Record<string, string>,
): Promise<T> {

  const logger = new Logger(threadsFetch);
  const baseURL = 'https://graph.threads.com/v1.0';

  const userId = env.THREADS_BOT_USER_ID;
  const accessToken = env.THREADS_BOT_ACCESS_TOKEN;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      ...body,
      access_token: accessToken,
    }),
  } as const;
  const finalURL = `${baseURL}/${userId}${path}`;

  logger.info(`try to hit api with url ${finalURL} and option ${JSON.stringify(options)}`)

  const response = await fetch(finalURL, options);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Threads API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}
