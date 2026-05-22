const express = require("express");
const whatsapp = require("../controllers/whatsappController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.post("/pairing-code", asyncHandler(whatsapp.pairingCode));
router.post("/qr", asyncHandler(whatsapp.qr));
router.get("/status", asyncHandler(whatsapp.status));
router.post("/reconnect", asyncHandler(whatsapp.reconnect));
router.post("/disconnect", asyncHandler(whatsapp.disconnect));

module.exports = router;
