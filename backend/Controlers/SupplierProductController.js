const SupplierProduct = require("../Model/SupplierProductModel");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage: storage });

const getAllSupplierProducts = async (req, res) => {
  try {
    const supplierproduct = await SupplierProduct.find();
    if (!supplierproduct.length) {
      return res.status(404).json({ message: "No supplier products found" });
    }
    res.status(200).json(supplierproduct);
  } catch (err) {
    res.status(500).json({ message: "Error fetching supplier products", error: err });
  }
};

// Add supplier product with image
const addSupplierProduct = async (req, res) => {
  const { name, price, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

  try {
    const supplierproduct = new SupplierProduct({ name, price, description, imageUrl });
    await supplierproduct.save();
    res.status(201).json({ message: "Supplier product added successfully", supplierproduct });
  } catch (err) {
    res.status(500).json({ message: "Error adding supplier product", error: err });
  }
};

const getbysupplierProductId = async (req, res) => {
  try {
    const supplierproduct = await SupplierProduct.findById(req.params.pid);
    if (!supplierproduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(supplierproduct);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error });
  }
};

const updateSupplierProduct = async (req, res) => {
  const { name, price, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const updateData = { name, price, description };
    if (imageUrl) updateData.imageUrl = imageUrl;

    const supplierproduct = await SupplierProduct.findByIdAndUpdate(req.params.pid, updateData, { new: true });
    if (!supplierproduct) {
      return res.status(404).json({ message: "No products found" });
    }

    res.status(200).json({ message: "Product updated successfully", supplierproduct });
  } catch (error) {
    res.status(500).json({ message: "Error updating product", error });
  }
};

const deleteSupplierProduct = async (req, res) => {
  try {
    const supplierproduct = await SupplierProduct.findByIdAndDelete(req.params.pid);
    if (!supplierproduct) {
      return res.status(404).json({ message: "Product not found" });
    }
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
