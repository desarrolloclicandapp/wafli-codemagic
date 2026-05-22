import * as client from "./client.js";
import * as auth from "./auth.js";
import * as me from "./me.js";
import * as whatsapp from "./whatsapp.js";
import * as chats from "./chats.js";
import * as ai from "./ai.js";
import * as billing from "./billing.js";
import * as push from "./push.js";
import * as privacy from "./privacy.js";
import * as system from "./system.js";
import * as analytics from "./analytics.js";
import * as admin from "./admin.js";

const WaFliAPI = { client, auth, me, whatsapp, chats, ai, billing, push, privacy, system, analytics, admin };

window.WaFliAPI = WaFliAPI;

export { WaFliAPI };
