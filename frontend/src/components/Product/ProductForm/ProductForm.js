import React, { useEffect, useMemo, useState } from "react";
import "./ProductForm.css";

const getTodayInputValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

function ProductForm() {
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    brand: "",
    inStock: false,
    stockAmount: "",
    image: null,
    supplierId: "",
    supplierProductId: "",
    expireTrackingEnabled: false,
    expiryDate: "",
    expiryReminderDays: "",
  });
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierErr, setSupplierErr] = useState("");
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);
  const [supplierProductsErr, setSupplierProductsErr] = useState("");

  const minExpiryDate = useMemo(() => getTodayInputValue(), []);

  const errorStyle = {
    color: "#b91c1c",
    fontSize: "0.85rem",
    marginTop: "4px",
  };

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev || !prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingSuppliers(true);
        // Fetch users and filter by supplier role (admin-only endpoint ideally)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.filter((u) => String(u?.role || '').toLowerCase() === 'supplier')
          : [];
        setSuppliers(list);
      } catch (e) {
        setSupplierErr(e.message || 'Could not load suppliers');
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, []);

  // Load supplier products whenever a supplier is selected
  useEffect(() => {
    const supplierId = formData.supplierId;
    if (!supplierId) {
      setSupplierProducts([]);
      setSupplierProductsErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSupplierProductsErr("");
        setLoadingSupplierProducts(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/supplier-products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load supplier products');
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((p) => {
          const sid = p?.supplierId?._id || p?.supplierId;
          return String(sid) === String(supplierId);
        });
        setSupplierProducts(filtered);
      } catch (e) {
        if (!cancelled) setSupplierProductsErr(e.message || 'Could not load supplier products');
      } finally {
        if (!cancelled) setLoadingSupplierProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.supplierId]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (name === "image") {
      const file = files && files[0] ? files[0] : null;
      setFormData((prev) => ({ ...prev, image: file }));
      if (file) clearFieldError("image");
      return;
    }

    if (type === "checkbox") {
      setFormData((prev) => {
        const next = { ...prev, [name]: checked };
        if (name === "expireTrackingEnabled" && !checked) {
          next.expiryDate = "";
          next.expiryReminderDays = "";
        }
        if (name === "inStock" && !checked) {
          next.stockAmount = "";
        }
        return next;
      });
      clearFieldError(name);
      if (name === "expireTrackingEnabled" && !checked) {
        clearFieldError("expiryDate");
        clearFieldError("expiryReminderDays");
      }
      if (name === "inStock" && !checked) {
        clearFieldError("stockAmount");
      }
      return;
    }

    if (name === "expiryReminderDays") {
      if (value === "" || value === null) {
        setFormData((prev) => ({ ...prev, expiryReminderDays: "" }));
        clearFieldError(name);
        return;
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        setErrors((prevErrors) => ({ ...prevErrors, [name]: "Enter a non-negative reminder" }));
        return;
      }
      setFormData((prev) => ({ ...prev, expiryReminderDays: String(Math.floor(numeric)) }));
      clearFieldError(name);
      return;
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "supplierId") {
        next.supplierProductId = "";
      }
      return next;
    });
    clearFieldError(name);
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const trimmedCategory = formData.category.trim();
    const trimmedBrand = formData.brand.trim();
    const priceValue = Number(formData.price);

    if (trimmedName.length < 2) {
      nextErrors.name = "Enter a valid name (min 2 characters)";
    }

    if (!String(formData.price).trim() || !Number.isFinite(priceValue) || priceValue <= 0) {
      nextErrors.price = "Enter a positive value for price";
    }

    if (!trimmedDescription) {
      nextErrors.description = "Description is required";
    }

    if (!trimmedCategory) {
      nextErrors.category = "Category is required";
    }

    if (!trimmedBrand) {
      nextErrors.brand = "Brand is required";
    }

    if (formData.inStock) {
      const stockValue = Number(formData.stockAmount);
      if (!String(formData.stockAmount).trim() || !Number.isFinite(stockValue) || stockValue <= 0) {
        nextErrors.stockAmount = "Enter a positive stock amount";
      }
    }

    if (formData.expireTrackingEnabled) {
      if (!formData.expiryDate) {
        nextErrors.expiryDate = "Select an expiry date";
      } else if (formData.expiryDate < minExpiryDate) {
        nextErrors.expiryDate = "Expiry date cannot be earlier than today";
      }

      if (
        formData.expiryReminderDays !== "" &&
        (!Number.isFinite(Number(formData.expiryReminderDays)) || Number(formData.expiryReminderDays) < 0)
      ) {
        nextErrors.expiryReminderDays = "Enter a non-negative reminder";
      }
    }

    if (!formData.image) {
      nextErrors.image = "Upload a product image";
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const trimmedCategory = formData.category.trim();
    const trimmedBrand = formData.brand.trim();
    const data = new FormData();
    data.append("name", trimmedName);
    data.append("price", Number(formData.price));
    data.append("description", trimmedDescription);
    data.append("category", trimmedCategory);
    data.append("brand", trimmedBrand);
    data.append("inStock", formData.inStock ? "true" : "false");
    data.append("stockAmount", formData.inStock ? String(Math.floor(Number(formData.stockAmount))) : "0");
    data.append("expireTrackingEnabled", formData.expireTrackingEnabled ? "true" : "false");
    data.append("expiryDate", formData.expireTrackingEnabled ? formData.expiryDate : "");
    data.append(
      "expiryReminderDays",
      formData.expireTrackingEnabled ? String(formData.expiryReminderDays || "") : ""
    );
    if (formData.supplierId) {
      data.append("supplierId", formData.supplierId);
    }
    if (formData.supplierProductId) {
      data.append("supplierProductId", formData.supplierProductId);
    }
    if (formData.image) {
      data.append("image", formData.image);
    }

    try {
  const res = await fetch("http://localhost:5000/products", { method: "POST", body: data });
      const result = await res.json();
      if (res.ok) {
        alert("Product added successfully!");
        setFormData({
          name: "",
          price: "",
          description: "",
          category: "",
          brand: "",
          inStock: false,
          stockAmount: "",
          image: null,
          supplierId: "",
          supplierProductId: "",
          expireTrackingEnabled: false,
          expiryDate: "",
          expiryReminderDays: "",
        });
        setErrors({});
      } else alert(result.message);
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} required />
      {errors.name ? <p style={errorStyle}>{errors.name}</p> : null}
      <input type="number" name="price" placeholder="Price" value={formData.price} onChange={handleChange} required />
      {errors.price ? <p style={errorStyle}>{errors.price}</p> : null}
      <input type="text" name="description" placeholder="Description" value={formData.description} onChange={handleChange} required />
      {errors.description ? <p style={errorStyle}>{errors.description}</p> : null}
      <input type="text" name="category" placeholder="Category" value={formData.category} onChange={handleChange} required />
      {errors.category ? <p style={errorStyle}>{errors.category}</p> : null}
      <input type="text" name="brand" placeholder="Brand" value={formData.brand} onChange={handleChange} required />
      {errors.brand ? <p style={errorStyle}>{errors.brand}</p> : null}

      <label>
        <input type="checkbox" name="inStock" checked={formData.inStock} onChange={handleChange} />
        In Stock
      </label>

      {formData.inStock && (
        <input type="number" name="stockAmount" placeholder="Stock Amount" value={formData.stockAmount} onChange={handleChange} min="1" required />
      )}
      {formData.inStock && errors.stockAmount ? <p style={errorStyle}>{errors.stockAmount}</p> : null}

      <fieldset className="expiry-fieldset">
        <legend>Expiration tracking (optional)</legend>
        <label>
          <input
            type="checkbox"
            name="expireTrackingEnabled"
            checked={formData.expireTrackingEnabled}
            onChange={handleChange}
          />
          Track expiry date for this product
        </label>
        {formData.expireTrackingEnabled && (
          <div className="expiry-controls">
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              min={minExpiryDate}
              required
            />
            {errors.expiryDate ? <p style={errorStyle}>{errors.expiryDate}</p> : null}
            <input
              type="number"
              name="expiryReminderDays"
              min="0"
              placeholder="Reminder days"
              value={formData.expiryReminderDays}
              onChange={handleChange}
            />
            {errors.expiryReminderDays ? <p style={errorStyle}>{errors.expiryReminderDays}</p> : null}
          </div>
        )}
      </fieldset>

      <input type="file" name="image" accept="image/*" onChange={handleChange} required />
      {errors.image ? <p style={errorStyle}>{errors.image}</p> : null}
      <div>
        <label>Supplier (internal)</label>
        <select name="supplierId" value={formData.supplierId} onChange={handleChange} disabled={loadingSuppliers}>
          <option value="">-- No supplier selected --</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>{s.name || s.email}</option>
          ))}
        </select>
        {!!supplierErr && <div className="muted" style={{ color: '#92400e' }}>{supplierErr}</div>}
      </div>
      {formData.supplierId && (
        <div>
          <label>Supplier Product (SKU)</label>
          <select
            name="supplierProductId"
            value={formData.supplierProductId || ""}
            onChange={handleChange}
            disabled={loadingSupplierProducts}
          >
            <option value="">-- Select supplier product --</option>
            {supplierProducts.map((sp) => (
              <option key={sp._id} value={sp._id}>
                {sp.name} — LKR {Number(sp.price || 0).toLocaleString('en-LK')}
              </option>
            ))}
          </select>
          {!!supplierProductsErr && <div className="muted" style={{ color: '#92400e' }}>{supplierProductsErr}</div>}
        </div>
      )}
      <button type="submit">Add Product</button>
    </form>
  );
}

export default ProductForm;
