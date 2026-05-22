const express = require("express");
const push = require("../controllers/pushController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth);
router.get("/preferences", asyncHandler(push.preferences));
router.patch("/preferences", asyncHandler(push.updatePreferences));
module.exports = router;
