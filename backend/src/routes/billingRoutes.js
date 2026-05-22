const express = require("express");
const billing = require("../controllers/billingController");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.get("/plan", requireAuth, asyncHandler(billing.plan));
router.get("/usage", requireAuth, asyncHandler(billing.usage));
router.post("/checkout/plan", requireAuth, asyncHandler(billing.checkoutPlan));
router.post("/checkout/pack", requireAuth, asyncHandler(billing.checkoutPack));
router.post("/customer-portal", requireAuth, asyncHandler(billing.portal));
router.get("/play/products", requireAuth, asyncHandler(billing.playProducts));
router.post("/play/purchase", requireAuth, asyncHandler(billing.recordPlayPurchase));
router.post("/native/sync", requireAuth, asyncHandler(billing.nativeSync));

module.exports = router;



