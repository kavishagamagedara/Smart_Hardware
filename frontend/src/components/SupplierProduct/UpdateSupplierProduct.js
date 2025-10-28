import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateSupplierProduct.css";
import { useAuth } from "../context/AuthContext";  // ✅ import auth

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function UpdateSupplierProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();  // ✅ get token

  const [product, setProduct] = useState({
    name: "",
    price: "",
    description: "",
    image: null,
    imageUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrMsg("");
    (async () => {
      try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_ROOT}/supplier-products/${id}`, { headers });
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        if (!res.ok) {
          const message =
            (payload && typeof payload === "object" && payload.message) ||
            (typeof payload === "string" && payload) ||
            "Failed to fetch supplier product";
          throw new Error(message);
        }
        if (!mounted) return;
        // Ensure controlled inputs are strings
        const normalized = {
          name: payload.name || "",
          price: payload.price != null ? String(payload.price) : "",
          description: payload.description || "",
          image: null,
          imageUrl: payload.imageUrl || "",
        };
        console.debug("Fetched supplier product:", payload);
        setProduct(normalized);
      } catch (err) {
        console.error("Error fetching product:", err);
        if (mounted) setErrMsg(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, token]);

  const handleChange = (e) => {
    if (e.target.type === "file") setProduct({ ...product, image: e.target.files[0] });
    else setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("name", product.name);
    data.append("price", product.price);
    data.append("description", product.description);
    if (product.image) data.append("image", product.image);

    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_ROOT}/supplier-products/${id}`, {
        method: "PUT",
        headers,
        body: data,
      });
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await res.json() : await res.text();
      if (res.ok) {
        alert("Supplier product updated successfully!");
        navigate("/supplier-products");
      } else {
        const message =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" && payload) ||
          "Failed to update product";
        alert(message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <div>
      {loading ? (
        <div>Loading product…</div>
      ) : errMsg ? (
        <div className="error">Error: {errMsg}</div>
      ) : (
        <form onSubmit={handleSubmit} className="update-supplier-form">
          <input type="text" name="name" placeholder="Name" value={product.name} onChange={handleChange} required />
          <input type="number" name="price" placeholder="Price" value={product.price} onChange={handleChange} required />
          <textarea name="description" placeholder="Description" value={product.description} onChange={handleChange} required />
          <input type="file" name="image" accept="image/*" onChange={handleChange} />
          {product.imageUrl && (
            <img src={product.imageUrl.startsWith("http") ? product.imageUrl : `${API_ROOT}${product.imageUrl}`} alt="Current" width="150" />
          )}
          <button type="submit">Update Supplier Product</button>
        </form>
      )}
    </div>
  );
}

export default UpdateSupplierProduct;
