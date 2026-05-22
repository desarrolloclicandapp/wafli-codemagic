const express = require("express");
const aiReportController = require("../controllers/aiReportController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, asyncHandler(aiReportController.create));

module.exports = router;
