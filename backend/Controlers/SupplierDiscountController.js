const SupplierDiscount = require("../Model/SupplierDiscountModel");
const SupplierProduct = require("../Model/SupplierProductModel");

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Object && value._id) return String(value._id);
  return String(value);
}

function isAdmin(req) {
  return String(req.user?.role || "").trim().toLowerCase() === "admin";
}

function buildNumber(value) {
  if (value === null || typeof value === "undefined") return NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

const listSupplierDiscounts = async (req, res) => {
  try {
  const query = {};
    const requesterIsAdmin = isAdmin(req);

    if (!requesterIsAdmin) {
      query.supplierId = req.user?._id;
    } else if (req.query?.supplierId) {
      query.supplierId = req.query.supplierId;
    }

    const discounts = await SupplierDiscount.find(query)
      .sort({ createdAt: -1 })
      .populate("productId", "name price")
      .populate("supplierId", "name email");
    const payload = discounts.map((discount) => {
      const doc = discount.toObject({ virtuals: true });
      if (typeof doc.discountPercent === "undefined" && typeof doc.discountAmount !== "undefined") {
        doc.discountPercent = doc.discountAmount;
      }
      return doc;
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error fetching supplier discounts", error);
    res.status(500).json({ message: "Error fetching supplier discounts" });
  }
};

const createSupplierDiscount = async (req, res) => {
  try {
    const requesterIsAdmin = isAdmin(req);
    const {
      productId,
      discountPercent: discountPercentRaw,
      discountAmount,
      minQuantity,
      note,
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({ message: "Product is required" });
    }

    const parsedDiscount = buildNumber(
      typeof discountPercentRaw !== "undefined" ? discountPercentRaw : discountAmount
    );
    if (!Number.isFinite(parsedDiscount) || parsedDiscount <= 0 || parsedDiscount > 100) {
      return res.status(400).json({ message: "Enter a valid discount percentage (0-100)" });
    }

    const parsedMinQty = Math.floor(buildNumber(minQuantity));
    if (!Number.isFinite(parsedMinQty) || parsedMinQty <= 0) {
      return res.status(400).json({ message: "Enter a valid minimum quantity" });
    }

    const product = await SupplierProduct.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

  const supplierIdFromProduct = normalizeId(product.supplierId);
  const supplierId = requesterIsAdmin ? supplierIdFromProduct : normalizeId(req.user?._id);

    if (!supplierId) {
      return res.status(400).json({ message: "Supplier is required" });
    }

    if (!requesterIsAdmin && supplierIdFromProduct !== normalizeId(req.user?._id)) {
      return res.status(403).json({ message: "Forbidden: you can only create offers for your products" });
    }

    const discount = new SupplierDiscount({
      supplierId,
      productId,
      discountPercent: parsedDiscount,
      minQuantity: parsedMinQty,
      note: (note || "").trim() || undefined,
    });

    await discount.save();
    await discount.populate([
      { path: "productId", select: "name price" },
      { path: "supplierId", select: "name email" },
    ]);
    const doc = discount.toObject({ virtuals: true });
    doc.discountPercent = doc.discountPercent ?? doc.discountAmount;

    res.status(201).json({ message: "Discount offer created", discount: doc });
  } catch (error) {
    console.error("Error creating supplier discount", error);
    res.status(500).json({ message: "Error creating supplier discount" });
  }
};

const deleteSupplierDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const discount = await SupplierDiscount.findById(id);
    if (!discount) {
      return res.status(404).json({ message: "Discount offer not found" });
    }

    const requesterIsAdmin = isAdmin(req);
    const ownsDiscount = normalizeId(discount.supplierId) === normalizeId(req.user?._id);

    if (!requesterIsAdmin && !ownsDiscount) {
      return res.status(403).json({ message: "Forbidden: you can only remove your offers" });
    }

    await discount.deleteOne();
    res.status(200).json({ message: "Discount offer removed" });
  } catch (error) {
    console.error("Error removing supplier discount", error);
    res.status(500).json({ message: "Error removing supplier discount" });
  }
};

module.exports = {
  listSupplierDiscounts,
  createSupplierDiscount,
  deleteSupplierDiscount,
};
