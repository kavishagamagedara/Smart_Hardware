const Product = require("../Model/ProductModel");
const Notification = require("../Model/NotificationModel");
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const isPastDate = (value) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const parseBooleanInput = (value) => {
  if (typeof value === "undefined") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
};

const coerceBoolean = (value, fallback = false) => {
  const parsed = parseBooleanInput(value);
  return typeof parsed === "undefined" ? fallback : parsed;
};

const parseOptionalDate = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const normalizeReminderDays = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return Math.max(0, Math.floor(fallback || 0));
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.max(0, Math.floor(numeric));
};

const formatExpiryMessageDate = (date) => {
  try {
    return date.toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
};

const maybeTriggerExpiryNotification = async (product) => {
  try {
    if (!product || !product.expireTrackingEnabled) return;

    const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return;

    const reminderDays = Math.max(0, Number(product.expiryReminderDays ?? 0));
    const diffMs = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / DAY_IN_MS);

    if (diffDays > reminderDays) {
      return;
    }

    if (product.expiryNotificationSentAt) {
      return;
    }

    const claimTimestamp = new Date();
    const claimResult = await Product.updateOne(
      {
        _id: product._id,
        $or: [
          { expiryNotificationSentAt: { $exists: false } },
          { expiryNotificationSentAt: null },
        ],
      },
      { expiryNotificationSentAt: claimTimestamp }
    );

    if (!claimResult || !claimResult.modifiedCount) {
      return;
    }

    let existingNotification = null;
    if (product.lastExpiryNotificationId) {
      existingNotification = await Notification.findById(product.lastExpiryNotificationId).lean();
    }
    if (!existingNotification) {
      existingNotification = await Notification.findOne({
        type: "inventory-expiry",
        "metadata.productId": product._id,
        status: "unread",
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (existingNotification) {
      await Product.updateOne(
        { _id: product._id },
        {
          expiryNotificationSentAt: existingNotification.createdAt || claimTimestamp,
          lastExpiryNotificationId: existingNotification._id,
        }
      );
      return;
    }

    const formattedDate = formatExpiryMessageDate(expiryDate);
    let notification;
    try {
      notification = await Notification.create({
        recipientRole: "admin",
        title: "Product expiring soon",
        message: `${product.name || "A product"} will expire on ${formattedDate}.`,
        type: "inventory-expiry",
        metadata: {
          productId: product._id,
          expiryDate: expiryDate.toISOString(),
          reminderDays,
        },
      });
    } catch (creationError) {
      await Product.updateOne(
        { _id: product._id },
        { expiryNotificationSentAt: null, lastExpiryNotificationId: undefined }
      );
      throw creationError;
    }

    await Product.updateOne(
      { _id: product._id },
      {
        expiryNotificationSentAt: notification.createdAt,
        lastExpiryNotificationId: notification._id,
      }
    );
  } catch (error) {
    console.error("Expiry notification dispatch failed:", error);
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    await Promise.allSettled(products.map((product) => maybeTriggerExpiryNotification(product)));
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
    const {
      name,
      price,
      description,
      category,
      brand,
      inStock,
      stockAmount,
      supplierId,
      supplierProductId,
      expireTrackingEnabled,
      expiryDate,
      expiryReminderDays,
    } = req.body;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

    const inStockFlag = coerceBoolean(inStock, false);
    const numericStock = Number(stockAmount);
    const normalizedStock = inStockFlag && Number.isFinite(numericStock) && numericStock > 0 ? numericStock : 0;

    const trackingEnabled = coerceBoolean(expireTrackingEnabled, false);
    const parsedExpiryDate = trackingEnabled ? parseOptionalDate(expiryDate) : null;
    if (trackingEnabled && !parsedExpiryDate) {
      return res.status(400).json({ message: "Invalid expiry date provided" });
    }

    if (trackingEnabled && isPastDate(parsedExpiryDate)) {
      return res.status(400).json({ message: "Expiry date cannot be in the past" });
    }

    const parsedReminderDays = trackingEnabled
      ? normalizeReminderDays(expiryReminderDays, 0)
      : undefined;
    if (trackingEnabled && parsedReminderDays === null) {
      return res.status(400).json({ message: "Invalid expiry reminder days" });
    }

    const product = new Product({
      name,
      price,
      description,
      category,
      brand,
      inStock: inStockFlag,
      stockAmount: normalizedStock,
      imageUrl,
      ...(supplierId ? { supplierId } : {}),
      ...(supplierProductId ? { supplierProductId } : {}),
      expireTrackingEnabled: trackingEnabled,
      expiryDate: trackingEnabled ? parsedExpiryDate : undefined,
      expiryReminderDays: trackingEnabled ? parsedReminderDays ?? 0 : undefined,
      expiryNotificationSentAt: null,
      lastExpiryNotificationId: undefined,
    });

    await product.save();
    await maybeTriggerExpiryNotification(product);
    const freshProduct = await Product.findById(product._id);

    return res
      .status(201)
      .json({ message: "Product added successfully", product: freshProduct || product });
  } catch (error) {
    return res.status(400).json({ message: "Error adding product", error });
  }
};

//update
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const {
      name,
      price,
      description,
      category,
      brand,
      inStock,
      stockAmount,
      supplierId,
      supplierProductId,
      expireTrackingEnabled,
      expiryDate,
      expiryReminderDays,
    } = req.body;

    const originalTracking = Boolean(product.expireTrackingEnabled);
    const originalExpiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
    const originalReminderDays = Number(product.expiryReminderDays ?? 0);

    if (typeof name !== "undefined") product.name = name;
    if (typeof price !== "undefined") product.price = price;
    if (typeof description !== "undefined") product.description = description;
    if (typeof category !== "undefined") product.category = category;
    if (typeof brand !== "undefined") product.brand = brand;

    let inStockFlag = product.inStock;
    const inStockProvided = typeof inStock !== "undefined";
    if (inStockProvided) {
      inStockFlag = coerceBoolean(inStock, product.inStock);
      product.inStock = inStockFlag;
    }

    const stockProvided = typeof stockAmount !== "undefined";
    if (stockProvided) {
      const numericStock = Number(stockAmount);
      if (Number.isFinite(numericStock) && numericStock >= 0) {
        product.stockAmount = inStockFlag ? Math.max(0, Math.floor(numericStock)) : 0;
      } else if (inStockFlag) {
        return res.status(400).json({ message: "Invalid stock amount" });
      } else {
        product.stockAmount = 0;
      }
    } else if (!inStockFlag) {
      product.stockAmount = 0;
    }

    if (supplierId === null || supplierId === "") {
      product.supplierId = undefined;
    } else if (typeof supplierId !== "undefined") {
      product.supplierId = supplierId;
    }

    if (supplierProductId === null || supplierProductId === "") {
      product.supplierProductId = undefined;
    } else if (typeof supplierProductId !== "undefined") {
      product.supplierProductId = supplierProductId;
    }

    if (req.file) {
      product.imageUrl = `/uploads/${req.file.filename}`;
    }

    const trackingProvided = typeof expireTrackingEnabled !== "undefined";
    let trackingFlag = product.expireTrackingEnabled;
    if (trackingProvided) {
      trackingFlag = coerceBoolean(expireTrackingEnabled, product.expireTrackingEnabled);
      product.expireTrackingEnabled = trackingFlag;
    }

    const dateProvided = typeof expiryDate !== "undefined";
    const reminderProvided = typeof expiryReminderDays !== "undefined";

    if (!product.expireTrackingEnabled) {
      if (trackingProvided) {
        product.expiryDate = undefined;
        product.expiryReminderDays = undefined;
        product.expiryNotificationSentAt = undefined;
        product.lastExpiryNotificationId = undefined;
      }
    } else {
      const parsedExpiryDate = dateProvided
        ? parseOptionalDate(expiryDate)
        : product.expiryDate
        ? new Date(product.expiryDate)
        : null;
      if (dateProvided && !parsedExpiryDate) {
        return res.status(400).json({ message: "Invalid expiry date provided" });
      }

      if (trackingFlag && parsedExpiryDate && isPastDate(parsedExpiryDate)) {
        return res.status(400).json({ message: "Expiry date cannot be in the past" });
      }

      const nextReminder = reminderProvided
        ? normalizeReminderDays(expiryReminderDays, 0)
        : product.expiryReminderDays ?? 0;
      if (reminderProvided && nextReminder === null) {
        return res.status(400).json({ message: "Invalid expiry reminder days" });
      }

      if (!parsedExpiryDate) {
        return res.status(400).json({ message: "Expiry date is required when tracking is enabled" });
      }

  product.expiryDate = parsedExpiryDate;
      product.expiryReminderDays = nextReminder;

      const reminderDays = Math.max(0, Number(product.expiryReminderDays ?? 0));
      const expiryDateValue = new Date(product.expiryDate);
      const diffDays = Math.ceil((expiryDateValue.getTime() - Date.now()) / DAY_IN_MS);

      const trackingJustEnabled = !originalTracking && product.expireTrackingEnabled;
      const expiryChanged =
        dateProvided &&
        ((originalExpiryDate && parsedExpiryDate && parsedExpiryDate.getTime() !== originalExpiryDate.getTime()) ||
          (!originalExpiryDate && parsedExpiryDate));
      const reminderChanged = reminderProvided && nextReminder !== originalReminderDays;

      if (trackingJustEnabled || expiryChanged || reminderChanged) {
        product.expiryNotificationSentAt = null;
        product.lastExpiryNotificationId = undefined;
      }

      if (diffDays > reminderDays) {
        product.expiryNotificationSentAt = null;
        product.lastExpiryNotificationId = undefined;
      }
    }

  await product.save({ runValidators: true });
  await maybeTriggerExpiryNotification(product);
  const freshProduct = await Product.findById(product._id);

  return res.status(200).json({ message: "Product updated successfully", product: freshProduct || product });
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
