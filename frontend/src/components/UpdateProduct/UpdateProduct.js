import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateProduct.css";

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 10);
};

const getTodayInputValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

function UpdateProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    brand: "",
    inStock: false,
    stockAmount: "",
    image: null,
    imageUrl: "",
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

  // Fetch product details
  useEffect(() => {
    fetch(`http://localhost:5000/products/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct({
          name: data.name || "",
          price: data.price || "",
          description: data.description || "",
          category: data.category || "",
          brand: data.brand || "",
          inStock: data.inStock || false,
          stockAmount: data.stockAmount || "",
          image: null,
          imageUrl: data.imageUrl || "",
          supplierId: data?.supplierId?._id || data?.supplierId || "",
          supplierProductId: data?.supplierProductId?._id || data?.supplierProductId || "",
          expireTrackingEnabled: Boolean(data?.expireTrackingEnabled),
          expiryDate: toDateInputValue(data?.expiryDate),
          expiryReminderDays:
            typeof data?.expiryReminderDays === "number" && !Number.isNaN(data.expiryReminderDays)
              ? String(data.expiryReminderDays)
              : "",
        });
      })
      .catch((err) => console.error("Error fetching product:", err));
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingSuppliers(true);
        setSupplierErr("");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const origin = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
        const res = await fetch(`${origin}/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load suppliers");
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.filter((u) => String(u?.role || "").toLowerCase() === "supplier")
          : [];
        setSuppliers(list);
      } catch (e) {
        setSupplierErr(e.message || "Could not load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, []);

  useEffect(() => {
    const supplierId = product.supplierId;
    if (!supplierId) {
      setSupplierProducts([]);
      setSupplierProductsErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingSupplierProducts(true);
        setSupplierProductsErr("");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const origin = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
        const res = await fetch(`${origin}/supplier-products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load supplier products");
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((p) => {
          const sid = p?.supplierId?._id || p?.supplierId;
          return String(sid) === String(supplierId);
        });
        setSupplierProducts(filtered);
      } catch (e) {
        if (!cancelled) setSupplierProductsErr(e.message || "Could not load supplier products");
      } finally {
        if (!cancelled) setLoadingSupplierProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.supplierId]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "file") {
      const file = files && files[0] ? files[0] : null;
      setProduct((prev) => ({ ...prev, image: file }));
      if (file) clearFieldError("image");
    } else if (type === "checkbox") {
      setProduct((prev) => {
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
    } else {
      if (name === "expiryReminderDays") {
        if (value === "" || value === null) {
          setProduct((prev) => ({ ...prev, expiryReminderDays: "" }));
          clearFieldError(name);
          return;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
          setErrors((prevErrors) => ({ ...prevErrors, [name]: "Enter a non-negative reminder" }));
          return;
        }
        setProduct((prev) => ({ ...prev, expiryReminderDays: String(Math.floor(numeric)) }));
        clearFieldError(name);
        return;
      }

      if (name === "supplierId") {
        setProduct((prev) => ({ ...prev, supplierId: value, supplierProductId: "" }));
        clearFieldError(name);
        return;
      }
      setProduct((prev) => ({ ...prev, [name]: value }));
      clearFieldError(name);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedName = product.name.trim();
    const trimmedDescription = product.description.trim();
    const trimmedCategory = product.category.trim();
    const trimmedBrand = product.brand.trim();
    const priceValue = Number(product.price);

    if (trimmedName.length < 2) {
      nextErrors.name = "Enter a valid name (min 2 characters)";
    }

    if (!String(product.price).trim() || !Number.isFinite(priceValue) || priceValue <= 0) {
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

    if (product.inStock) {
      const stockValue = Number(product.stockAmount);
      if (!String(product.stockAmount).trim() || !Number.isFinite(stockValue) || stockValue <= 0) {
        nextErrors.stockAmount = "Enter a positive stock amount";
      }
    }

    if (product.expireTrackingEnabled) {
      if (!product.expiryDate) {
        nextErrors.expiryDate = "Select an expiry date";
      } else if (product.expiryDate < minExpiryDate) {
        nextErrors.expiryDate = "Expiry date cannot be earlier than today";
      }

      if (
        product.expiryReminderDays !== "" &&
        (!Number.isFinite(Number(product.expiryReminderDays)) || Number(product.expiryReminderDays) < 0)
      ) {
        nextErrors.expiryReminderDays = "Enter a non-negative reminder";
      }
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

    const data = new FormData();
    data.append("name", product.name.trim());
    data.append("price", Number(product.price));
    data.append("description", product.description.trim());
    data.append("category", product.category.trim());
    data.append("brand", product.brand.trim());
    data.append("inStock", product.inStock ? "true" : "false");
    data.append("stockAmount", product.inStock ? String(Math.floor(Number(product.stockAmount))) : "0");
    data.append("expireTrackingEnabled", product.expireTrackingEnabled ? "true" : "false");
    data.append("expiryDate", product.expireTrackingEnabled ? product.expiryDate : "");
    data.append(
      "expiryReminderDays",
      product.expireTrackingEnabled ? String(product.expiryReminderDays || "") : ""
    );
    data.append("supplierId", product.supplierId || "");
    data.append("supplierProductId", product.supplierProductId || "");
    if (product.image) data.append("image", product.image); // optional new image

    try {
      const res = await fetch(`http://localhost:5000/products/${id}`, {
        method: "PUT",
        body: data,
      });

      const result = await res.json();
      if (res.ok) {
        alert("✅ Product updated successfully!");
        navigate("/products");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Something went wrong!");
    }
  };

  return (
    <div className="update-product-container">
      <h2>Edit product</h2>
      <form onSubmit={handleSubmit} className="update-product-form">
        <div>
          <label htmlFor="product-name">Name</label>
          <input
            id="product-name"
            className="input"
            type="text"
            name="name"
            placeholder="Name"
            value={product.name}
            onChange={handleChange}
            required
          />
          {errors.name ? <p style={errorStyle}>{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="product-price">Price</label>
          <input
            id="product-price"
            className="input"
            type="number"
            name="price"
            placeholder="Price"
            value={product.price}
            onChange={handleChange}
            required
          />
          {errors.price ? <p style={errorStyle}>{errors.price}</p> : null}
        </div>

        <div>
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            className="input"
            name="description"
            placeholder="Description"
            value={product.description}
            onChange={handleChange}
            required
          />
          {errors.description ? <p style={errorStyle}>{errors.description}</p> : null}
        </div>

        <div>
          <label htmlFor="product-category">Category</label>
          <input
            id="product-category"
            className="input"
            type="text"
            name="category"
            placeholder="Category"
            value={product.category}
            onChange={handleChange}
            required
          />
          {errors.category ? <p style={errorStyle}>{errors.category}</p> : null}
        </div>

        <div>
          <label htmlFor="product-brand">Brand</label>
          <input
            id="product-brand"
            className="input"
            type="text"
            name="brand"
            placeholder="Brand"
            value={product.brand}
            onChange={handleChange}
            required
          />
          {errors.brand ? <p style={errorStyle}>{errors.brand}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="product-instock"
            type="checkbox"
            name="inStock"
            checked={product.inStock}
            onChange={handleChange}
          />
          <label htmlFor="product-instock">Stock available</label>
        </div>

        {product.inStock && (
          <div>
            <label htmlFor="product-stock">Stock amount</label>
            <input
              id="product-stock"
              className="input"
              type="number"
              name="stockAmount"
              placeholder="Stock amount"
              value={product.stockAmount}
              onChange={handleChange}
              min="1"
              required
            />
          </div>
        )}
        {product.inStock && errors.stockAmount ? <p style={errorStyle}>{errors.stockAmount}</p> : null}

        <fieldset className="expiry-fieldset">
          <legend>Expiration tracking (optional)</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="expireTrackingEnabled"
              checked={product.expireTrackingEnabled}
              onChange={handleChange}
            />
            Track expiry date for this product
          </label>
          {product.expireTrackingEnabled && (
            <div className="expiry-controls">
              <div>
                <label htmlFor="product-expiry-date">Expiry date</label>
                <input
                  id="product-expiry-date"
                  className="input"
                  type="date"
                  name="expiryDate"
                  value={product.expiryDate}
                  onChange={handleChange}
                  min={minExpiryDate}
                  required
                />
              </div>
              {errors.expiryDate ? <p style={errorStyle}>{errors.expiryDate}</p> : null}
              <div>
                <label htmlFor="product-expiry-reminder">Reminder days</label>
                <input
                  id="product-expiry-reminder"
                  className="input"
                  type="number"
                  min="0"
                  name="expiryReminderDays"
                  placeholder="e.g. 7"
                  value={product.expiryReminderDays}
                  onChange={handleChange}
                />
              </div>
              {errors.expiryReminderDays ? <p style={errorStyle}>{errors.expiryReminderDays}</p> : null}
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="product-image">Upload product image</label>
          <input
            id="product-image"
            className="input"
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
          />
          {errors.image ? <p style={errorStyle}>{errors.image}</p> : null}
        </div>

        {product.imageUrl && (
          <div className="stack-xs">
            <p className="text-muted">Current image</p>
            <img
              src={`http://localhost:5000${product.imageUrl}`}
              alt="Current"
              style={{ width: "160px", borderRadius: "12px" }}
            />
          </div>
        )}

        <div>
          <label htmlFor="product-supplier">Supplier</label>
          <select
            id="product-supplier"
            className="input"
            name="supplierId"
            value={product.supplierId}
            onChange={handleChange}
            disabled={loadingSuppliers}
          >
            <option value="">-- No supplier selected --</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name || s.email}
              </option>
            ))}
          </select>
          {!!supplierErr && (
            <p className="text-muted" style={{ color: "#92400e" }}>{supplierErr}</p>
          )}
        </div>

        {product.supplierId
          ? (() => {
              const selectedExists = supplierProducts.some(
                (sp) => String(sp._id) === String(product.supplierProductId)
              );
              return (
                <div>
                  <label htmlFor="product-supplier-product">Supplier product</label>
                  <select
                    id="product-supplier-product"
                    className="input"
                    name="supplierProductId"
                    value={product.supplierProductId || ""}
                    onChange={handleChange}
                    disabled={loadingSupplierProducts}
                  >
                    <option value="">-- Select supplier product --</option>
                    {!selectedExists && product.supplierProductId ? (
                      <option value={product.supplierProductId}>
                        Current selection (not in supplier catalog list)
                      </option>
                    ) : null}
                    {supplierProducts.map((sp) => (
                      <option key={sp._id} value={sp._id}>
                        {sp.name} — LKR {Number(sp.price || 0).toLocaleString("en-LK")}
                      </option>
                    ))}
                  </select>
                  {!!supplierProductsErr && (
                    <p className="text-muted" style={{ color: "#92400e" }}>{supplierProductsErr}</p>
                  )}
                  {!loadingSupplierProducts && !selectedExists && product.supplierProductId ? (
                    <p className="text-muted" style={{ color: "#475569" }}>
                      Current supplier product is no longer listed; saving will keep the existing link unless you choose another.
                    </p>
                  ) : null}
                </div>
              );
            })()
          : null}
        <button type="submit" className="btn btn-primary">
          Update product
        </button>
      </form>
    </div>
  );
}

export default UpdateProduct;
