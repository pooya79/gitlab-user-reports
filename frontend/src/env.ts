import { z } from "zod";

const envSchema = z.object({
    BACKEND_URL: z.url().default("http://localhost:8000"),
});

export const env = envSchema.parse({
    BACKEND_URL: process.env.BACKEND_URL,
});
