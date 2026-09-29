import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getVendorProducts, uploadUrl } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function VendorProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getVendorProducts().then(setProducts).catch((requestError) => setError(requestError.message || 'Could not load products')).finally(() => setLoading(false))
  }, [])

  return <div><div className="page-heading"><div><p className="eyebrow">SELLER WORKSPACE</p><h1>Product catalog</h1><p>Manage the listings customers see in your storefront.</p></div><Link className="primary-button" to="/add-product">＋ Add product</Link></div>{loading ? <div className="loading-state">Loading products...</div> : error ? <div className="state-box">{error}</div> : <section className="workspace-section"><div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-art"><img src={uploadUrl(product.image)} alt={product.name} />{product.tag && <span className="product-tag">{product.tag}</span>}</div><div className="product-info"><h3>{product.name}</h3><p>{product.category}</p><div className="product-meta"><strong>{formatPrice(product.price)}</strong><span>{product.stock} in stock</span></div><div className="action-row"><Link className="text-button" to={`/products/${product.id}`}>Preview →</Link></div></div></article>)}</div>{products.length === 0 && <div className="workspace-empty">No products yet. Add your first listing to open your storefront.</div>}</section>}</div>
}
