const express = require("express");
const profile = require("../controllers/profileController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/onboarding-status", asyncHandler(profile.onboardingStatus));
router.post("/legal-acceptance", asyncHandler(profile.acceptLegal));
router.patch("/profile", asyncHandler(profile.updateProfile));
router.get("/profile", asyncHandler(profile.getProfile));

module.exports = router;
