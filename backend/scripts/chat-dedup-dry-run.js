const chatService = require("../src/services/chatService");
const { pool } = require("../src/config/db");

function parseArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

async function main() {
  const userIdRaw = parseArg("userId");
  const limitRaw = parseArg("limit");
  const userId = userIdRaw ? Number.parseInt(userIdRaw, 10) : null;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 25;
  const diagnostics = await chatService.getDuplicateChatDiagnostics(
    Number.isFinite(userId) && userId > 0 ? userId : null,
    { limit }
  );

  console.log(JSON.stringify({
    mode: "dry-run",
    warning: "No se modifico ningun dato. Revisa las propuestas antes de hacer cualquier merge real.",
    ...diagnostics
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
