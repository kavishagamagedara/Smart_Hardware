const SupplierProduct = require("../Model/SupplierProductModel");
const multer = require("multer");
const path = require("path");

/* ------------------- Multer setup ------------------- */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage });

/* ------------------- Get all supplier products ------------------- */
const getAllSupplierProducts = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role.toLowerCase() === "supplier") {
      // Supplier sees only their own products
      filter = { supplierId: req.user._id };
    }

    // Admin can see all
    const supplierProducts = await SupplierProduct.find(filter);

    if (!supplierProducts.length) {
      return res.status(404).json({ message: "No supplier products found" });
    }

    res.status(200).json(supplierProducts);
  } catch (err) {
    res.status(500).json({ message: "Error fetching supplier products", error: err });
  }
};

const addSupplierProduct = async (req, res) => {
  const { name, price, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

  try {
    const supplierproduct = new SupplierProduct({
      name,
      price,
      description,
      imageUrl,
      supplierId: req.user._id,   // ✅ save supplier
    });
    await supplierproduct.save();
    res.status(201).json({ message: "Supplier product added successfully", supplierproduct });
  } catch (err) {
    res.status(500).json({ message: "Error adding supplier product", error: err });
  }
};

/* ------------------- Get by ID ------------------- */
const getbysupplierProductId = async (req, res) => {
  try {
    const supplierProduct = await SupplierProduct.findById(req.params.pid);

    if (!supplierProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Suppliers can only access their own
    if (
      req.user.role.toLowerCase() === "supplier" &&
      supplierProduct.supplierId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your product" });
    }

    res.status(200).json(supplierProduct);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error });
  }
};

/* ------------------- Update supplier product ------------------- */
const updateSupplierProduct = async (req, res) => {
  const { name, price, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const supplierProduct = await SupplierProduct.findById(req.params.pid);
    if (!supplierProduct) {
      return res.status(404).json({ message: "No product found" });
    }

    // Suppliers can only update their own
    if (
      req.user.role.toLowerCase() === "supplier" &&
      supplierProduct.supplierId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your product" });
    }

    supplierProduct.name = name ?? supplierProduct.name;
    supplierProduct.price = price ?? supplierProduct.price;
    supplierProduct.description = description ?? supplierProduct.description;
    if (imageUrl) supplierProduct.imageUrl = imageUrl;

    await supplierProduct.save();

    res.status(200).json({ message: "Product updated successfully", supplierProduct });
  } catch (error) {
    res.status(500).json({ message: "Error updating product", error });
  }
};

/* ------------------- Delete supplier product ------------------- */
const deleteSupplierProduct = async (req, res) => {
  try {
    const supplierProduct = await SupplierProduct.findById(req.params.pid);
    if (!supplierProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Suppliers can only delete their own
    if (
      req.user.role.toLowerCase() === "supplier" &&
      supplierProduct.supplierId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your product" });
    }

    await supplierProduct.deleteOne();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
};

module.exports = {
  getAllSupplierProducts,
  addSupplierProduct,
  getbysupplierProductId,
  updateSupplierProduct,
  deleteSupplierProduct,
  upload,
};
