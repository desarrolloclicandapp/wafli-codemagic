const express = require("express");
const admin = require("../controllers/adminController");
const { requireAdminAuth } = require("../middleware/adminAuth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.post("/auth/login", asyncHandler(admin.login));
router.get("/users", requireAdminAuth, asyncHandler(admin.users));
router.post("/users/:id/trial", requireAdminAuth, asyncHandler(admin.extendTrial));
router.post("/users/:id/generations", requireAdminAuth, asyncHandler(admin.addGenerations));
router.post("/users/:id/suspend", requireAdminAuth, asyncHandler(admin.suspendUser));
router.delete("/users/:id", requireAdminAuth, asyncHandler(admin.deleteUser));

module.exports = router;
