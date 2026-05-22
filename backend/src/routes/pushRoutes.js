const express = require("express");
const push = require("../controllers/pushController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/public-key", asyncHandler(push.publicKey));
router.post("/subscribe", asyncHandler(push.subscribe));
router.post("/native-token", asyncHandler(push.subscribeNative));
router.post("/unsubscribe", asyncHandler(push.unsubscribe));
router.get("/preferences", asyncHandler(push.preferences));
router.patch("/preferences", asyncHandler(push.updatePreferences));

module.exports = router;
