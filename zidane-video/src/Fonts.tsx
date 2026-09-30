import { continueRender, delayRender, staticFile } from "remotion";
import { theme } from "./theme";

// Fonts are vendored in public/fonts so the render never depends on the network.
const FACES = [
  { family: theme.fonts.display, weight: "700", file: "sora-latin-700-normal.woff2" },
  { family: theme.fonts.display, weight: "800", file: "sora-latin-800-normal.woff2" },
  { family: theme.fonts.body, weight: "400", file: "inter-latin-400-normal.woff2" },
  { family: theme.fonts.body, weight: "500", file: "inter-latin-500-normal.woff2" },
  { family: theme.fonts.body, weight: "600", file: "inter-latin-600-normal.woff2" },
];

const handle = delayRender("Loading fonts");
Promise.all(
  FACES.map(async (f) => {
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, { weight: f.weight });
    await face.load();
    document.fonts.add(face);
  }),
).then(() => continueRender(handle));
