import { continueRender, delayRender, staticFile } from "remotion";
import { theme } from "./theme";

// Fonts are vendored in public/fonts so the render never depends on the network.
const FACES = [
  { family: theme.fonts.display, weight: "700", file: "sora-latin-700-normal.woff2" },
  { family: theme.fonts.display, weight: "800", file: "sora-latin-800-normal.woff2" },
  { family: theme.fonts.body, weight: "400", file: "inter-latin-400-normal.woff2" },
  { family: theme.fonts.body, weight: "500", file: "inter-latin-500-normal.woff2" },
  { family: theme.fonts.body, weight: "600", file: "inter-latin-600-normal.woff2" },
  { family: "Fraunces", weight: "600", file: "fraunces-latin-600-normal.woff2" },
  { family: "Fraunces", weight: "600", style: "italic", file: "fraunces-latin-600-italic.woff2" },
  { family: "Fraunces", weight: "400", style: "italic", file: "fraunces-latin-400-italic.woff2" },
  { family: "Fraunces", weight: "300", file: "fraunces-latin-300-normal.woff2" },
  { family: "Fraunces", weight: "300", style: "italic", file: "fraunces-latin-300-italic.woff2" },
  { family: "Passion One", weight: "900", file: "passion-one-900.ttf" },
];

const handle = delayRender("Loading fonts");
Promise.all(
  FACES.map(async (f) => {
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("${f.file.endsWith(".ttf") ? "truetype" : "woff2"}")`, { weight: f.weight, style: (f as { style?: string }).style ?? "normal" });
    await face.load();
    document.fonts.add(face);
  }),
).then(() => continueRender(handle));
