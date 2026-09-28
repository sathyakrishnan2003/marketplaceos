import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addToCart, getCategories, getProducts } from '../services/api'

function imageUrl(image) {
  if (!image) return null
  if (image.startsWith('/uploads')) return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${image}`
  return image
}

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function Products({ session, onSignOut }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All products')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeLink, setNoticeLink] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getProducts(), getCategories()])
      .then(([nextProducts, nextCategories]) => {
        setProducts(nextProducts)
        setCategories(nextCategories)
      })
      .catch((requestError) => setError(requestError.message || 'Could not load the shop'))
      .finally(() => setLoading(false))
  }, [])

  const categoryOptions = useMemo(() => ['All products', ...categories.map((item) => item.name)], [categories])
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === 'All products' || product.category === category
    const search = query.trim().toLowerCase()
    return matchesCategory && (!search || `${product.name} ${product.vendor || ''} ${product.category || ''}`.toLowerCase().includes(search))
  })

  async function add(product) {
    if (!session) {
      navigate('/login')
      return
    }
    try {
      await addToCart(product.id)
      setNotice(`${product.name} added to cart`)
      setNoticeLink('/cart')
      window.setTimeout(() => {
        setNotice('')
        setNoticeLink(null)
      }, 2500)
    } catch (requestError) {
      setNotice(requestError.message || 'Could not add this product')
      setNoticeLink(null)
      window.setTimeout(() => setNotice(''), 3500)
    }
  }

  return <div className="shop-shell">
    <header className="shop-header">
      <Link className="brand shop-brand" to="/shop"><span className="brand-mark">M</span><span>marketplace<span className="brand-dot">.</span></span></Link>
      <nav className="shop-nav"><Link to="/shop">Shop</Link>{session?.user?.role === 'customer' && <Link to="/customer">Dashboard</Link>}<Link to="/vendors">Our makers</Link></nav>
      <div className="shop-search search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, brands and more" /></div>
      <div className="shop-actions">
        {session?.user?.role === 'customer' && <Link to="/orders">Orders</Link>}
        {session?.user?.role === 'customer' && <Link to="/cart">Cart</Link>}
        {session && session.user.role !== 'customer' && <Link className="shop-profile" to={session.user.role === 'vendor' ? '/vendor' : '/admin'}>{session.user.name?.slice(0, 2).toUpperCase() || 'ME'}</Link>}
        {session && <button type="button" className="shop-logout" onClick={onSignOut}>Log out</button>}
        {!session && <Link to="/login">Sign in</Link>}
      </div>
    </header>
    <main className="shop-main">
      <section className="shop-hero"><p className="eyebrow">CURATED INDEPENDENT BRANDS</p><h1>Good things,<br /><em>made thoughtfully.</em></h1><p>Discover useful, beautiful products from makers you can feel good about supporting.</p><a className="primary-button" href="#catalog">Explore the collection <span>↓</span></a></section>
      <div id="catalog" className="shop-heading"><div><p className="eyebrow">EXPLORE THE MARKETPLACE</p><h2>Find your next favourite</h2></div><span>{visibleProducts.length} products</span></div>
      <div className="shop-filters">{categoryOptions.map((item) => <button key={item} className={category === item ? 'filter active' : 'filter'} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {loading && <div className="loading-state">Loading products...</div>}
      {error && <div className="state-box">{error}</div>}
      {!loading && !error && <div className="shop-grid">{visibleProducts.map((product) => <article className="shop-product" key={product.id}>
        <Link to={`/products/${product.id}`} className="product-art"><img src={imageUrl(product.image)} alt={product.name} /><span className="product-tag">{product.tag}</span></Link>
        <div className="shop-product-info"><p>{product.category}</p><h3><Link to={`/products/${product.id}`}>{product.name}</Link></h3><div><strong>{formatPrice(product.price)}</strong><span>★ {Number(product.rating || 0).toFixed(1)} · {product.sales || 0} sold</span></div><button className="secondary-button" onClick={() => add(product)} disabled={!session}>Add to cart</button></div>
      </article>)}</div>}
      {!loading && !error && visibleProducts.length === 0 && <div className="empty-state">No products match that search.</div>}
      <footer className="shop-footer"><strong>marketplace<span>.</span></strong><span>Independent makers · Protected payments · Thoughtful delivery</span><Link to="/vendors">Meet the makers →</Link></footer>
    </main>
    {notice && <div className="toast" role="status">{notice}{noticeLink && <Link className="toast-link" to={noticeLink}>View cart →</Link>}</div>}
  </div>
}
