const express = require("express");
const auth = require("../controllers/authController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, refreshLimiter } = require("../middleware/rateLimit");

const router = express.Router();
router.post("/oauth/verify", authLimiter, asyncHandler(auth.socialLogin));
router.post("/refresh", refreshLimiter, asyncHandler(auth.refresh));
router.post("/logout", asyncHandler(auth.logout));
router.get("/me", requireAuth, asyncHandler(auth.me));

module.exports = router;
