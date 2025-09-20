const Product = require("../Model/ProductModel");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching products", error });
  }
};

// GET by ID
const getbyId = async (req, res) => {
  try {
    const product = await Product.findById(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching product", error });
  }
};

const addProduct = async (req, res) => {
  try {
    const { name, price, description, category, brand, inStock, stockAmount } =
      req.body;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

    const product = new Product({
      name,
      price,
      description,
      category,
      brand,
      inStock,
      stockAmount: inStock ? stockAmount : 0,
      imageUrl,
    });

    await product.save();
    return res
      .status(201)
      .json({ message: "Product added successfully", product });
  } catch (error) {
    return res.status(400).json({ message: "Error adding product", error });
  }
};

//update
const updateProduct = async (req, res) => {
  try {
    const { name, price, description, category, brand, inStock, stockAmount } =
      req.body;

    const updateData = {
      name,
      price,
      description,
      category,
      brand,
      inStock,
      stockAmount: inStock ? stockAmount : 0,
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.pid,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res
      .status(200)
      .json({ message: "Product updated successfully", product });
  } catch (error) {
    return res.status(500).json({ message: "Error updating product", error });
  }
};

//DELETE
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product", error });
  }
};

module.exports = {
  getAllProducts,
  addProduct,
  getbyId,
  updateProduct,
  deleteProduct,
  upload,
};
