import { describe, expect, test } from "bun:test";
import { findMarkedEquations } from "../plugin/scripts/equations.js";

describe("findMarkedEquations", () => {
  test("recognizes inline and display delimiters and retains original source", () => {
    expect(findMarkedEquations("$a$ and \\(b\\) and $$c$$ and \\[d\\]")).toEqual([
      { source: "$a$", latex: "a", display: false, start: 0 },
      { source: "\\(b\\)", latex: "b", display: false, start: 8 },
      { source: "$$c$$", latex: "c", display: true, start: 18 },
      { source: "\\[d\\]", latex: "d", display: true, start: 28 },
    ]);
  });

  test("accepts multiline display equations and ignores escaped or unclosed delimiters", () => {
    expect(findMarkedEquations("\\$5 and $x$ and $$a\nb$$ and $unfinished\n$y$")).toEqual([
      { source: "$x$", latex: "x", display: false, start: 8 },
      { source: "$$a\nb$$", latex: "a\nb", display: true, start: 16 },
      { source: "$y$", latex: "y", display: false, start: 40 },
    ]);
  });
});
