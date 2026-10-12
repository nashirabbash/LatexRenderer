import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const pluginConfig = JSON.parse(readFileSync(new URL("../plugin/config.json", import.meta.url), "utf8"));

describe("plugin configuration", () => {
  test("opens the plugin panel HTML entry point", () => {
    expect(pluginConfig.variations[0].url).toBe("index.html");
  });
});
