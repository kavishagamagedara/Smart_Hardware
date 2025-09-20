const express = require("express");
const router = express.Router();
const SupplierProductController = require("../Controlers/SupplierProductController");

router.get("/", SupplierProductController.getAllSupplierProducts);
router.post("/", SupplierProductController.upload.single("image"), SupplierProductController.addSupplierProduct);
router.get("/:pid", SupplierProductController.getbysupplierProductId);
router.put("/:pid", SupplierProductController.upload.single("image"), SupplierProductController.updateSupplierProduct);
router.delete("/:pid", SupplierProductController.deleteSupplierProduct);

module.exports = router;
