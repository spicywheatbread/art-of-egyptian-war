import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/firestore-websocket.integration.test.ts"],
          globals: false,
        },
      }),
      defineProject({
        test: {
          name: "firestore-integration",
          environment: "node",
          include: ["tests/firestore-websocket.integration.test.ts"],
          setupFiles: ["tests/setup/firestore-integration-env.ts"],
          globals: false,
        },
      }),
    ],
  },
});
