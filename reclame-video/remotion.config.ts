import { Config } from "@remotion/cli/config";

// 8 GB RAM pe mașina de randare: două pagini de Chrome în paralel e plafonul sigur.
Config.setConcurrency(2);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
