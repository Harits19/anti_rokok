/**
 * Spec OpenAPI 3.1 — sumber kebenaran dokumentasi API.
 * Minimal: health + webhook (publik) + publish text (API key).
 * Update saat tambah/ubah endpoint.
 */
export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Anti-Rokok Bot API",
    description: "Bot edukasi bahaya rokok. Publish teks ke Threads via akun bot tunggal. Bun + Express. Tanpa database.",
    version: "0.2.0",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "health" },
    { name: "threads" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "Cek kesehatan server",
        responses: { "200": { description: "Sehat" } },
      },
    },

    "/threads/publish": {
      post: {
        tags: ["threads"],
        summary: "Publish teks ke Threads via akun bot — butuh API key",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { text: { type: "string", minLength: 1, maxLength: 5000, example: "Test from api" } },
                required: ["text"],
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          "201": { description: "Teks terpublish (threadId)" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "503": { $ref: "#/components/responses/ServiceUnavailable" },
        },
      },
    },

  },

  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "Isi API_KEY dari .env" },
    },
    responses: {
      BadRequest: { description: "Input tidak valid" },
      Unauthorized: { description: "API key / token verifikasi salah" },
      ServiceUnavailable: { description: "Layanan eksternal gagal (mis. akun bot belum dikonfigurasi)" },
    },
  },
};
