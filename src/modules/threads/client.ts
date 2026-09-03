/**
 * Client HTTP minimal untuk Threads API (Graph API Meta).
 * Flow publish: 1) buat container 2) publish container.
 */
export class ThreadsApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ThreadsApiError";
  }
}

export class ThreadsClient {
  private static readonly API_BASE = "https://graph.threads.net";
  private static readonly API_VERSION = "v1.0";

  constructor(
    private readonly threadsUserId: string,
    private readonly accessToken: string,
  ) {}

  /** Buat container post teks. Kembalikan creation_id. */
  async createTextPost(text: string): Promise<string> {
    const params = new URLSearchParams({ media_type: "TEXT", text, access_token: this.accessToken });
    const data = await this.request<{ id: string }>(`/${this.threadsUserId}/threads`, params);
    return data.id;
  }

  /** Publish container. Kembalikan thread (post) id. */
  async publish(creationId: string): Promise<string> {
    const params = new URLSearchParams({ creation_id: creationId, access_token: this.accessToken });
    const data = await this.request<{ id: string }>(`/${this.threadsUserId}/threads_publish`, params);
    return data.id;
  }

  /** Helper: post teks langsung (create + publish). */
  async publishText(text: string): Promise<string> {
    const creationId = await this.createTextPost(text);
    return this.publish(creationId);
  }

  private async request<T>(path: string, params: URLSearchParams): Promise<T> {
    const res = await fetch(`${ThreadsClient.API_BASE}/${ThreadsClient.API_VERSION}${path}?${params}`);
    const body = (await res.json()) as T & { error?: { message?: string; code?: number } };

    if (!res.ok) {
      const detail = body?.error?.message ?? JSON.stringify(body);
      throw new ThreadsApiError(`Threads API error ${res.status}: ${detail}`, res.status);
    }
    return body;
  }
}
