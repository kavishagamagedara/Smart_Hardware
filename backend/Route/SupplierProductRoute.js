const express = require("express");
const router = express.Router();
const SupplierProductController = require("../Controlers/SupplierProductController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// All supplier routes require authentication
router.get("/", requireAuth, SupplierProductController.getAllSupplierProducts);
router.post("/", requireAuth, SupplierProductController.upload.single("image"), SupplierProductController.addSupplierProduct);
router.get("/:pid", requireAuth, SupplierProductController.getbysupplierProductId);
router.put("/:pid", requireAuth, SupplierProductController.upload.single("image"), SupplierProductController.updateSupplierProduct);
router.delete("/:pid", requireAuth, SupplierProductController.deleteSupplierProduct);

module.exports = router;
