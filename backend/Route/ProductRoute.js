const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  addProduct,
  getbyId,
  updateProduct,
  deleteProduct,
  upload,
} = require("../Controlers/ProductController");


router.get("/", getAllProducts);
router.get("/:pid", getbyId);
router.post("/", upload.single("image"), addProduct);
router.put("/:pid", upload.single("image"), updateProduct);
router.delete("/:pid", deleteProduct);

module.exports = router;
