const fs = require("fs");
const path = require("path");

const validateConnectionPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@whiskeysockets",
  "baileys",
  "lib",
  "Utils",
  "validate-connection.js"
);

const oldPlatform = "platform: proto.ClientPayload.UserAgent.Platform.WEB,";
const macosPlatform = "platform: proto.ClientPayload.UserAgent.Platform.MACOS,";

if (!fs.existsSync(validateConnectionPath)) {
  console.warn(`[patch-baileys] Baileys validate-connection.js not found at ${validateConnectionPath}`);
  process.exit(0);
}

const source = fs.readFileSync(validateConnectionPath, "utf8");

if (source.includes(macosPlatform)) {
  console.log("[patch-baileys] Baileys MACOS platform patch already applied");
  process.exit(0);
}

if (!source.includes(oldPlatform)) {
  console.warn("[patch-baileys] Expected Baileys WEB platform marker was not found; leaving package unchanged");
  process.exit(0);
}

fs.writeFileSync(validateConnectionPath, source.replace(oldPlatform, macosPlatform));
console.log("[patch-baileys] Patched Baileys UserAgent platform WEB -> MACOS");
