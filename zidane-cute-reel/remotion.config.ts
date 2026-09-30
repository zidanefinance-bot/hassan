import { Config } from "@remotion/cli/config";

// Cloud sandbox: use the pre-installed Playwright headless shell instead of downloading one.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setVideoImageFormat("jpeg");
