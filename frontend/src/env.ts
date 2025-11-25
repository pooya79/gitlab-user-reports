import { z } from "zod";

const envSchema = z.object({
    BACKEND_URL: z.string().min(1).default("http://localhost:8000"),
});

export const env = envSchema.parse({
    BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
});
