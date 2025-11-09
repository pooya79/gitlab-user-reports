import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
    input: "./openapi.json",
    output: "./src/client",

    plugins: [
        {
            name: "@hey-api/client-next",
            runtimeConfigPath: "@/hey-api",
        },
        "zod",
        {
            name: "@hey-api/sdk",
            validator: true,
        },
    ],
});
