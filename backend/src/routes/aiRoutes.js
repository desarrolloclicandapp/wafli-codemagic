const express = require("express");
const ai = require("../controllers/aiController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth, requireWhatsappConnected } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");

const router = express.Router();
router.use(requireAuth, requireWhatsappConnected, aiLimiter);
router.post("/suggest", asyncHandler(ai.suggest));
router.post("/rewrite", asyncHandler(ai.rewrite));
router.post("/analyze", asyncHandler(ai.analyze));
router.post("/opener", asyncHandler(ai.opener));
router.post("/reactivate", asyncHandler(ai.reactivate));
router.post("/regenerate", asyncHandler(ai.regenerate));

module.exports = router;
