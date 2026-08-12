import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Există un package-lock.json rătăcit în C:\Users\PC care derutează
  // detecția de workspace a Turbopack — fixăm rădăcina explicit.
  turbopack: { root: path.join(__dirname) },
};

export default withNextIntl(nextConfig);
