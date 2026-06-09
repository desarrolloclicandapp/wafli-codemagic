const express = require("express");
const chat = require("../controllers/chatController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth, requireWhatsappConnected } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/events", asyncHandler(chat.events));
router.use(requireWhatsappConnected);
router.get("/", asyncHandler(chat.list));
router.get("/contacts", asyncHandler(chat.contacts));
router.post("/contacts", asyncHandler(chat.createContact));
router.get("/:chatId/ai-profile", asyncHandler(chat.getAiProfile));
router.patch("/:chatId/ai-profile", asyncHandler(chat.updateAiProfile));
router.post("/:chatId/ai-profile/reset", asyncHandler(chat.resetAiProfile));
router.get("/:chatId", asyncHandler(chat.get));
router.get("/:chatId/messages", asyncHandler(chat.messages));
router.get("/:chatId/messages/:messageId/media", asyncHandler(chat.media));
router.patch("/:chatId/messages/:messageId", asyncHandler(chat.editMessage));
router.post("/:chatId/messages/:messageId/delete", asyncHandler(chat.deleteMessage));
router.post("/:chatId/read", asyncHandler(chat.markRead));
router.post("/:chatId/presence", asyncHandler(chat.presence));
router.post("/:chatId/start", asyncHandler(chat.startConversation));
router.post("/:chatId/send-media", express.raw({ type: "*/*", limit: "12mb" }), asyncHandler(chat.sendMedia));
router.post("/:chatId/send", asyncHandler(chat.send));
router.patch("/:chatId/meta", asyncHandler(chat.updateMeta));
router.patch("/:chatId/contact", asyncHandler(chat.updateContact));

module.exports = router;
