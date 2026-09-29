import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addToCart, createReview, getOrder, getOrders, getProduct, getProductRating, getProductReviews, uploadUrl } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function ProductDetails({ session, onSignOut }) {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [rating, setRating] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewOrders, setReviewOrders] = useState([])
  const [form, setForm] = useState({ order_id: '', rating: '5', comment: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  useEffect(() => {
    Promise.all([getProduct(id), getProductRating(id), getProductReviews(id)])
      .then(([nextProduct, nextRating, nextReviews]) => {
        setProduct(nextProduct)
        setRating(nextRating)
        setReviews(nextReviews.reviews || [])
      })
      .catch((requestError) => setError(requestError.message || 'Could not load this product'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (session?.user?.role !== 'customer') return
    getOrders().then((nextOrders) => Promise.all(nextOrders.filter((order) => order.status === 'delivered').map((order) => getOrder(order.id))))
      .then((details) => {
        setReviewOrders(details.flat().filter((order) => order.items?.some((item) => String(item.product_id) === String(id))))
      }).catch(() => {})
  }, [id, session])

  async function add() {
    if (!session) {
      window.location.assign('/login')
      return
    }
    try {
      await addToCart(product.id)
      setNotice('Added to cart')
      window.setTimeout(() => setNotice(''), 2500)
    } catch (requestError) {
      setNotice(requestError.message || 'Could not add this product')
    }
  }

  async function submitReview(event) {
    event.preventDefault()
    setSavingReview(true)
    setError('')
    try {
      await createReview({ product_id: Number(id), order_id: Number(form.order_id), rating: Number(form.rating), comment: form.comment })
      setNotice('Review published')
      setForm({ order_id: '', rating: '5', comment: '' })
      getProductReviews(id).then((nextReviews) => setReviews(nextReviews.reviews || []))
      getProductRating(id).then(setRating)
    } catch (requestError) {
      setError(requestError.message || 'Could not publish review')
    } finally {
      setSavingReview(false)
    }
  }

  if (loading) return <div className="public-page"><div className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace.</span></Link></div><div className="loading-state">Loading product...</div></div>
  if (error && !product) return <div className="public-page"><div className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace.</span></Link></div><div className="state-box">{error}</div></div>

  return <div className="public-page">
    <header className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace<span className="brand-dot">.</span></span></Link><nav><Link to="/shop">Back to shop</Link><Link to="/vendors">All vendors</Link>{session?.user?.role === 'customer' && <Link to="/cart">Cart</Link>}{session && <button type="button" className="shop-logout" onClick={onSignOut}>Log out</button>}</nav></header>
    <main className="public-grid">
      <div className="detail-grid">
        <div className="detail-media"><img src={uploadUrl(product.image)} alt={product.name} /></div>
        <div className="detail-content"><Link className="vendor-link" to={`/vendors/${product.vendor_id}`}>{product.vendor} →</Link><h1>{product.name}</h1><p className="description">{product.description}</p><div className="price">{formatPrice(product.price)}</div><p className="badge">{product.category} · {product.stock} in stock</p><div className="action-row" style={{ marginTop: 24 }}><button className="primary-button" onClick={add}>Add to cart</button><Link className="secondary-button" to={`/vendors/${product.vendor_id}`}>Visit vendor</Link></div></div>
      </div>
      <section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">CUSTOMER REVIEWS</p><h2>{Number(rating?.avg_rating || product.rating || 0).toFixed(1)} ★</h2><p>{rating?.review_count || product.review_count || 0} verified reviews</p></div></div><div className="review-list">{reviews.length ? reviews.map((review) => <article className="review-card" key={review.id}><header><strong>{review.customer}</strong><time>{new Date(review.created_at).toLocaleDateString('en-IN')}</time></header><p>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p><p>{review.comment || 'Verified purchase'}</p></article>) : <div className="workspace-empty">No reviews yet.</div>}</div></section>
      {session?.user?.role === 'customer' && <section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">YOUR EXPERIENCE</p><h2>Share a review</h2><p>Only delivered purchases can be reviewed.</p></div></div>{reviewOrders.length ? <form className="form-grid" onSubmit={submitReview}><div className="form-row"><label>Delivered order<select value={form.order_id} onChange={(event) => setForm({ ...form, order_id: event.target.value })} required><option value="">Choose an order</option>{reviewOrders.map((order) => <option value={order.id} key={order.id}>Order #{order.id} · {formatPrice(order.total_amount)}</option>)}</select></label></div><div className="form-row"><label>Rating<select value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })}><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label></div><div className="form-row"><label>Comment<textarea rows="4" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label></div><button className="primary-button" disabled={savingReview}>{savingReview ? 'Publishing...' : 'Publish review'}</button></form> : <div className="workspace-empty">Deliver an order containing this product to review it.</div>}</section>}
      {error && <div className="state-box">{error}</div>}
    </main>
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}
