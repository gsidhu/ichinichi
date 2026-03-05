import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("NoteEditor header layout", () => {
  it("lets the title row grow so weather can align to right edge", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");
    const headerTitleRuleMatch = css.match(/\.headerTitle\s*\{[^}]*\}/m);

    expect(headerTitleRuleMatch).toBeTruthy();
    expect(headerTitleRuleMatch?.[0]).toMatch(/\bflex\s*:\s*1\b/);
  });
});
