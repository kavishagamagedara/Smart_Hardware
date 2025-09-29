// src/Components/Reviews/SubmitReview.js
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import StarRating from './StarRating.js';
import './SubmitReview.css';

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const resolveMediaUrl = (url) => {
  if (!url) return '';
  const normalized = url.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_ROOT}${withLeadingSlash}`;
};

// ✅ helper: sanitize productId so no `{}` sneak in
const cleanId = (id) => {
  if (!id) return '';
  return String(id).replace(/[{}]/g, '').trim();
};


export default function SubmitReview() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Get product info from URL parameters
  const productId = cleanId(params.get('productId') || '');
  const productName = params.get('productName') || '';
  
  // edit mode (when coming from My Reviews)
  const rid = params.get('rid');

  const [product, setProduct] = useState({ 
    id: productId, 
    name: productName 
  });

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [retainedImages, setRetainedImages] = useState([]);
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function boot() {
      setErr(''); 
      setErrors([]); 
      setExisting(null);
      setSuccess(false);

      if (rid) {
        // Edit mode - load existing review
        try {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'x-user-id': user._id,
            'x-user-role': user.role,
            'x-user-name': user.name
          };

          const { data } = await axios.get(`${API_ROOT}/api/reviews/${rid}`, { headers });
          if (cancelled) return;
          
          setExisting(data);
          setRating(data.rating);
          setTitle(data.title || '');
          setComment(data.comment || '');
          const normalizedImages = Array.isArray(data.images) ? data.images : [];
          setExistingImages(normalizedImages);
          setRetainedImages(normalizedImages);
          setProduct({
            id: cleanId(data.targetKey || data.targetId || productId),
            name: data.targetName || productName
          });
        } catch (e) {
          if (!cancelled) {
            setErr(e?.response?.data?.message || e.message || 'Failed to load review');
          }
        }
        return;
      } else {
        setExistingImages([]);
        setRetainedImages([]);
      }

      // New review mode - check if product exists and if user can review
      if (productId) {
        try {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'x-user-id': user._id,
            'x-user-role': user.role,
            'x-user-name': user.name
          };

          // Check if user can review this product
          const { data } = await axios.get(
            `${API_ROOT}/api/reviews/product/${productId}/can-review`, 
            { headers }
          );

          if (cancelled) return;

          if (!data.canReview && data.hasReviewed) {
            setErr('You have already reviewed this product. You can edit your existing review from "My Reviews".');
            setExisting(data.existingReview);
          } else {
            setProduct({ id: productId, name: productName || data.product?.name || 'Unknown Product' });
          }
        } catch (e) {
          console.error("❌ Error checking product details:", e);
          console.log("➡️ productId:", productId, "➡️ productName:", productName);

          if (!cancelled) {
            setErr(e?.response?.data?.message || 'Error checking product details');
          }
        }
      } else {
        console.warn("⚠️ Missing productId or productName:", { productId, productName });
        setErr('Product information is missing');
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [rid, productId, productName, user, token, navigate]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length + retainedImages.length > 5) {
      setErr('You can upload a maximum of 5 images');
      return;
    }
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setErr('Only image files are allowed');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErr('Each image must be less than 5MB');
        return false;
      }
      return true;
    });

    setImages(prev => [...prev, ...validFiles]);
    setErr(''); 
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExistingImage = (image) => {
    setRetainedImages((prev) => {
      if (prev.includes(image)) {
        setErr('');
        return prev.filter((item) => item !== image);
      }

      const newTotal = prev.length + images.length + 1;
      if (newTotal > 5) {
        setErr('You can keep or upload a maximum of 5 images in total');
        return prev;
      }

      setErr('');
      return [...prev, image];
    });
  };

  const validate = () => {
    const e = [];
    if (!(rating >= 1 && rating <= 5)) e.push('Rating must be 1..5');
    if (title.length > 200) e.push('Title is too long (max 200)');
    if (comment.trim().length < 5) e.push('Comment must be at least 5 characters');
    if (comment.length > 3000) e.push('Comment is too long (max 3000)');
    if (images.length + retainedImages.length > 5) e.push('Maximum 5 images allowed');
    setErrors(e);
    return e.length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    
    setSaving(true);
    setErr('');
    setErrors([]);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      const formData = new FormData();
      formData.append('targetType', 'Product');
      if (product.id) formData.append('targetId', cleanId(product.id));
      formData.append('targetName', product.name);
      formData.append('rating', rating);
      formData.append('title', title);
      formData.append('comment', comment);

      if (existing) {
        formData.append('retainImages', JSON.stringify(retainedImages));
      }

      images.forEach((file) => {
        formData.append('images', file);
      });

      if (existing) {
        await axios.patch(`${API_ROOT}/api/reviews/${existing._id}`, formData, { headers });
      } else {
        await axios.post(`${API_ROOT}/api/reviews`, formData, { headers });
      }

      setSuccess(true);
      setTimeout(() => {
  const reviewProductId = cleanId(
  product.id || product._id || product.targetId || product.targetKey
);

if (!reviewProductId || reviewProductId.length !== 24) {
  alert("⚠️ Invalid productId, redirecting to dashboard.");
  navigate('/CustomerDashboard');
  return;
}

navigate(`/product/${reviewProductId}/reviews`);
}, 2000);


    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Server error');
      setErrors(e?.response?.data?.errors || []);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="submit-review-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to write a review.</p>
          <button onClick={() => navigate('/login')} className="btn-login">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (err && !existing) {
    return (
      <div className="submit-review-container">
        <div className="error-message">
          <h2>Unable to Submit Review</h2>
          <p>{err}</p>
          <button onClick={() => navigate(-1)} className="btn-back">Go Back</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="submit-review-container">
        <div className="success-message">
          <h2>✅ Review Submitted Successfully!</h2>
          <p>Thank you for your feedback. Your review has been submitted and will be visible to other customers.</p>
          <p>Redirecting you to the reviews page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-review-container">
      <div className="review-form-card">
        <h2>{existing ? 'Edit Your Review' : 'Write a Review'}</h2>
        
        <div className="product-info">
          <h3>Product: {product.name}</h3>
          <p className="product-id">ID: {product.id}</p>
        </div>

        {existing && (
          <div className="edit-notice">
            <p>You are editing your existing review for this product.</p>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="form-group">
            <label>Rating *</label>
            <StarRating value={rating} onChange={setRating} />
            <small>Rate this product from 1 to 5 stars</small>
          </div>

          <div className="form-group">
            <label htmlFor="title">Review Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience (optional)"
              maxLength={200}
            />
            <small>{title.length}/200 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="comment">Your Review *</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this product..."
              rows={6}
              maxLength={3000}
              required
            />
            <small>{comment.length}/3000 characters (minimum 5)</small>
          </div>

          {existing && existingImages.length > 0 && (
            <div className="form-group">
              <label>Existing Photos</label>
              <small>Select photos to keep. Unselected images will be removed when you save.</small>
              <div className="image-previews existing">
                {existingImages.map((image, index) => {
                  const src = resolveMediaUrl(image);
                  const isKept = retainedImages.includes(image);
                  return (
                    <div key={index} className={`image-preview ${isKept ? 'kept' : 'removed'}`}>
                      <img src={src} alt={`Existing attachment ${index + 1}`} />
                      <button
                        type="button"
                        onClick={() => toggleExistingImage(image)}
                        className={`toggle-image ${isKept ? 'toggle-remove' : 'toggle-restore'}`}
                      >
                        {isKept ? 'Remove' : 'Keep'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="images">Add Photos (Optional)</label>
            <input
              id="images"
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              disabled={images.length + retainedImages.length >= 5}
            />
            <small>You can upload up to 5 images (max 5MB each)</small>
            
            {images.length > 0 && (
              <div className="image-previews">
                {images.map((file, index) => (
                  <div key={index} className="image-preview">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="remove-image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((error, i) => (
                <p key={i} className="error">{error}</p>
              ))}
            </div>
          )}

          {err && (
            <div className="error-message">
              <p>{err}</p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-cancel"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={saving || !comment.trim() || comment.length < 5}
            >
              {saving ? 'Submitting...' : existing ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
