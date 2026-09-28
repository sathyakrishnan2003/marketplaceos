import { useEffect, useState } from 'react'
import { createProduct, getCategories } from '../services/api'

function AddProduct({ onBack }) {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category_id: '' })
  const [image, setImage] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getCategories().then(setCategories).catch(() => setError('Could not load categories')) }, [])
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })
  async function submit(event) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    const data = new FormData()
    Object.entries(form).forEach(([key, value]) => data.append(key, value))
    if (image) data.append('image', image)
    try {
      await createProduct(data)
      setMessage('Product created successfully.')
      setForm({ name: '', description: '', price: '', stock: '', category_id: '' }); setImage(null)
    } catch (requestError) { setError(requestError.message) } finally { setSaving(false) }
  }
  return <section className="form-page"><button className="back-button" onClick={onBack}>← Back to overview</button><div className="form-heading"><div><p className="eyebrow">CATALOG / NEW LISTING</p><h1>Add a product</h1><p className="subheading">Create a listing for your storefront and start selling.</p></div></div><form className="product-form" onSubmit={submit}><div className="form-column"><label>Product name<input value={form.name} onChange={update('name')} placeholder="e.g. Hand-thrown ceramic vase" required /></label><label>Description<textarea value={form.description} onChange={update('description')} placeholder="Tell customers what makes this product special" rows="5" /></label><div className="form-pair"><label>Price (INR)<input type="number" min="1" step="0.01" value={form.price} onChange={update('price')} placeholder="0.00" required /></label><label>Stock<input type="number" min="0" value={form.stock} onChange={update('stock')} placeholder="0" required /></label></div><label>Category<select value={form.category_id} onChange={update('category_id')} required><option value="">Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div><div className="form-column"><label>Product image<input className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImage(event.target.files[0])} /><span className="upload-hint">PNG, JPG or WEBP · max 5MB</span></label><div className="listing-note"><span>✦</span><div><strong>Good listings convert better</strong><p>Use a clear name, honest description and bright product image to help customers choose with confidence.</p></div></div>{message && <p className="success-message">{message}</p>}{error && <p className="auth-error">{error}</p>}<button className="primary-button form-submit" disabled={saving}>{saving ? 'Publishing...' : 'Publish product →'}</button></div></form></section>
}

export default AddProduct