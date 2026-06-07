import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.muscleyamato.app",
  appName: "MUSCLE YAMATO",
  // Next.js の静的書き出し先
  webDir: "out",
  ios: {
    contentInset: "always",
  },
};

export default config;
