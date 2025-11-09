import type { CreateClientConfig } from "@/client/client.gen";
import { getAccessToken } from "@/lib/auth";
import { env } from "@/env";

export const createClientConfig: CreateClientConfig = (config) => ({
    ...config,
    baseUrl: env.BACKEND_URL,
    auth: () => getAccessToken() ?? "",
});
