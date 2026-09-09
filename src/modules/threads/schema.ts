import { z } from "zod";

export const publishTextInput = z.object({
  text: z.string().trim().min(1, "Teks tidak boleh kosong").max(5000, "Maksimal 5000 karakter"),
});

export type PublishTextInput = z.infer<typeof publishTextInput>;



export interface AppAccessTokenResponse {
  "access_token": `TH|${number}|${string}`,
  "token_type": "bearer"
}