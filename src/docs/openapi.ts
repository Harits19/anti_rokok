/**
 * Spec OpenAPI 3.1 — sumber kebenaran dokumentasi API.
 * Dipakai Swagger UI di GET /docs. Update saat tambah/ubah endpoint.
 */
export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Anti-Rokok API",
    description: "Bot edukasi/sosialisasi bahaya rokok terintegrasi Threads. Modular monolith: Bun + Express + Drizzle + SQLite.",
    version: "0.1.0",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "health" },
    { name: "contents" },
    { name: "campaigns" },
    { name: "threads" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "Cek kesehatan server + DB",
        responses: {
          "200": { description: "Sehat" },
          "503": { description: "DB down" },
        },
      },
    },

    "/contents": {
      get: {
        tags: ["contents"],
        summary: "List konten (filter status opsional)",
        parameters: [
          { name: "status", in: "query", required: false, schema: { type: "string", enum: ["draft", "pending_approval", "approved", "rejected", "published"] } },
        ],
        responses: { "200": { description: "Daftar konten" } },
      },
      post: {
        tags: ["contents"],
        summary: "Buat konten (status awal: draft)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateContentInput" },
            },
          },
        },
        responses: {
          "201": { description: "Konten dibuat" },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },

    "/contents/generate": {
      post: {
        tags: ["contents"],
        summary: "Generate draf konten via AI lalu simpan sebagai draft",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateContentInput" },
            },
          },
        },
        responses: {
          "201": { description: "Draf AI tersimpan" },
          "502": { description: "AI provider gagal" },
        },
      },
    },

    "/contents/{id}": {
      get: {
        tags: ["contents"],
        summary: "Detail konten",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          "200": { description: "Detail konten" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/contents/{id}/submit": {
      post: {
        tags: ["contents"],
        summary: "Submit konten ke antrian approval (draft -> pending_approval)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { "200": { description: "Status berubah" }, "409": { $ref: "#/components/responses/Conflict" } },
      },
    },

    "/contents/{id}/publish": {
      post: {
        tags: ["contents"],
        summary: "Publish konten langsung ke Threads (harus approved)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          "200": { description: "Terpublish" },
          "409": { $ref: "#/components/responses/Conflict" },
          "503": { $ref: "#/components/responses/ServiceUnavailable" },
        },
      },
    },

    "/campaigns": {
      get: {
        tags: ["campaigns"],
        summary: "List campaign",
        responses: { "200": { description: "Daftar campaign" } },
      },
      post: {
        tags: ["campaigns"],
        summary: "Buat campaign",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCampaignInput" } } },
        },
        responses: { "201": { description: "Campaign dibuat" }, "400": { $ref: "#/components/responses/BadRequest" } },
      },
    },

    "/campaigns/{id}": {
      get: {
        tags: ["campaigns"],
        summary: "Detail campaign",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { "200": { description: "Detail campaign" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },

    "/campaigns/{id}/contents": {
      get: {
        tags: ["campaigns"],
        summary: "List konten milik campaign",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { "200": { description: "Daftar konten" } },
      },
    },

    "/campaigns/{id}/schedule": {
      post: {
        tags: ["campaigns"],
        summary: "Jadwalkan campaign (konten harus approved)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ScheduleCampaignInput" } } },
        },
        responses: { "200": { description: "Campaign scheduled" }, "400": { $ref: "#/components/responses/BadRequest" }, "409": { $ref: "#/components/responses/Conflict" } },
      },
    },

    "/campaigns/{id}/cancel": {
      post: {
        tags: ["campaigns"],
        summary: "Batalkan campaign",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { "200": { description: "Campaign dibatalkan" }, "409": { $ref: "#/components/responses/Conflict" } },
      },
    },

    "/campaigns/approvals/approve": {
      post: {
        tags: ["campaigns"],
        summary: "Setujui konten (pending_approval -> approved)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewContentInput" } } },
        },
        responses: { "200": { description: "Konten disetujui" }, "409": { $ref: "#/components/responses/Conflict" } },
      },
    },

    "/campaigns/approvals/reject": {
      post: {
        tags: ["campaigns"],
        summary: "Tolak konten (pending_approval -> rejected)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewContentInput" } } },
        },
        responses: { "200": { description: "Konten ditolak" }, "409": { $ref: "#/components/responses/Conflict" } },
      },
    },

    "/threads/webhook": {
      get: {
        tags: ["threads"],
        summary: "Verifikasi webhook (dipanggil Meta saat setup) — publik, tanpa API key",
        security: [],
        parameters: [
          { name: "hub.mode", in: "query", required: true, schema: { type: "string" } },
          { name: "hub.verify_token", in: "query", required: true, schema: { type: "string" } },
          { name: "hub.challenge", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Challenge dikembalikan" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["threads"],
        summary: "Terima event webhook Threads (dicatat + dianalisis AI) — publik, tanpa API key",
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Event diterima" } },
      },
    },
  },

  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "Isi API_KEY dari .env" },
    },
    parameters: {
      Id: { name: "id", in: "path", required: true, schema: { type: "integer" } },
    },
    responses: {
      BadRequest: { description: "Input tidak valid" },
      Unauthorized: { description: "Token verifikasi salah" },
      NotFound: { description: "Resource tidak ditemukan" },
      Conflict: { description: "Transisi status tidak diizinkan" },
      ServiceUnavailable: { description: "Layanan eksternal belum siap (mis. akun Threads / AI)" },
    },
    schemas: {
      CreateContentInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 200 },
          body: { type: "string", minLength: 1, maxLength: 5000 },
          campaignId: { type: "integer" },
        },
        required: ["body"],
        additionalProperties: false,
      },
      GenerateContentInput: {
        type: "object",
        properties: {
          topic: { type: "string", minLength: 3, maxLength: 200 },
          tone: { type: "string", maxLength: 50 },
        },
        required: ["topic"],
        additionalProperties: false,
      },
      CreateCampaignInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3, maxLength: 200 },
          description: { type: "string", maxLength: 1000 },
        },
        required: ["name"],
        additionalProperties: false,
      },
      ScheduleCampaignInput: {
        type: "object",
        properties: {
          scheduleAt: { type: "string", format: "date-time", description: "ISO 8601" },
          contentIds: { type: "array", items: { type: "integer" }, minItems: 1 },
        },
        required: ["scheduleAt", "contentIds"],
        additionalProperties: false,
      },
      ReviewContentInput: {
        type: "object",
        properties: {
          contentId: { type: "integer" },
          reason: { type: "string", maxLength: 500 },
        },
        required: ["contentId"],
        additionalProperties: false,
      },
    },
  },
};

/**
 * API key HANYA untuk modul fitur (contents & campaigns).
 * Publik: /health, /threads/webhook (dipanggil Meta tanpa key).
 * Keamanan ditandai per-operasi via tag agar spec sinkron dengan middleware di app.ts.
 */
type Operation = { tags?: readonly string[]; security?: unknown[] };
const PROTECTED_TAGS = new Set(["contents", "campaigns"]);
for (const pathItem of Object.values(openapiSpec.paths)) {
  for (const operation of Object.values(pathItem) as Operation[]) {
    if (operation && typeof operation === "object" && operation.tags?.some((tag) => PROTECTED_TAGS.has(tag))) {
      operation.security = [{ ApiKeyAuth: [] }];
    }
  }
}
