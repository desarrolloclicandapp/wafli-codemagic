const express = require("express");
const ai = require("../controllers/aiController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth, requireWhatsappConnected } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const MANUAL_AI_CHAT_ID = "wafli-ai-manual";

function isManualAiRequest(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const manualContext = body.manualContext && typeof body.manualContext === "object" ? body.manualContext : null;
  const chatId = String(body.chatId || "").trim();
  const message = String(manualContext?.message || manualContext?.messageToReply || "").trim();
  return chatId === MANUAL_AI_CHAT_ID && Boolean(message);
}

function requireWhatsappConnectedUnlessManual(req, res, next) {
  if (isManualAiRequest(req)) return next();
  return requireWhatsappConnected(req, res, next);
}

router.post("/tools/reply", requireAuth, aiLimiter, asyncHandler(ai.toolReply));
router.post("/tools/icebreakers", requireAuth, aiLimiter, asyncHandler(ai.toolIcebreakers));
router.get("/tools/saved-lines", requireAuth, asyncHandler(ai.listSavedLines));
router.post("/tools/saved-lines", requireAuth, asyncHandler(ai.saveLine));
router.delete("/tools/saved-lines/:id", requireAuth, asyncHandler(ai.deleteLine));

router.use(requireAuth, requireWhatsappConnectedUnlessManual, aiLimiter);
router.post("/suggest", asyncHandler(ai.suggest));
router.post("/rewrite", asyncHandler(ai.rewrite));
router.post("/analyze", asyncHandler(ai.analyze));
router.post("/opener", asyncHandler(ai.opener));
router.post("/reactivate", asyncHandler(ai.reactivate));
router.post("/regenerate", asyncHandler(ai.regenerate));

module.exports = router;
