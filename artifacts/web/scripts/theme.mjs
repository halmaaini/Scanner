import { readFileSync } from "node:fs";

// The design tokens live in src/index.css. The few places that cannot read CSS
// (the web app manifest, the browser's theme colour, the app icons) take their
// colours from here, so a colour is still written down once.
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

function token(name) {
  const value = css.match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`),
  )?.[1];
  if (!value)
    throw new Error(`Design token --color-${name} not found in src/index.css`);
  return value;
}

export const theme = {
  ink: token("ink"),
  paper: token("paper"),
  gold: token("gold"),
};
