import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateSupplierProduct.css";
import { useAuth } from "../context/AuthContext";  // ✅ import auth

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

  useEffect(() => {
    if (!token) return; // wait until logged in
    fetch(`http://localhost:5000/SupplierProducts/${id}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",  // ✅ attach token
      },
    })
      .then((res) => res.json())
      .then((data) => setProduct({ ...data, image: null, imageUrl: data.imageUrl || "" }))
      .catch((err) => console.error("Error fetching product:", err));
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
      const res = await fetch(`http://localhost:5000/SupplierProducts/${id}`, {
        method: "PUT",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",  // ✅ attach token
        },
        body: data,
      });
      const result = await res.json();
      if (res.ok) {
        alert("Supplier product updated successfully!");
        navigate("/supplier-products");
      } else alert(result.message);
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="update-supplier-form">
      <input type="text" name="name" placeholder="Name" value={product.name} onChange={handleChange} required />
      <input type="number" name="price" placeholder="Price" value={product.price} onChange={handleChange} required />
      <textarea name="description" placeholder="Description" value={product.description} onChange={handleChange} required />
      <input type="file" name="image" accept="image/*" onChange={handleChange} />
      {product.imageUrl && <img src={`http://localhost:5000${product.imageUrl}`} alt="Current" width="150" />}
      <button type="submit">Update Supplier Product</button>
    </form>
  );
}

export default UpdateSupplierProduct;
