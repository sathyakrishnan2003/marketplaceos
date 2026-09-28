import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCart, getOrders } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

function Metric({ label, value, detail, tone = 'orange' }) {
  return <article className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>↗</span></div>
    <strong>{value}</strong>
    <p>{detail}</p>
  </article>
}

export default function CustomerDashboard({ session }) {
  const [orders, setOrders] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getOrders(), getCart()])
      .then(([nextOrders, nextCart]) => {
        setOrders(nextOrders)
        setCart(nextCart)
      })
      .catch((requestError) => setError(requestError.message || 'Could not load your dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const activeOrders = orders.filter((order) => ['paid', 'shipped'].includes(order.status))
  const deliveredOrders = orders.filter((order) => order.status === 'delivered')
  const cartCount = cart.reduce((count, item) => count + Number(item.quantity || 0), 0)
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)

  return <div>
    <div className="page-heading">
      <div>
        <p className="eyebrow">CUSTOMER OVERVIEW</p>
        <h1>Good morning, {session.user?.name?.split(' ')[0] || 'Customer'}</h1>
        <p>Track your orders, cart and marketplace activity in one place.</p>
      </div>
      <Link className="primary-button" to="/shop">Continue shopping</Link>
    </div>
    {loading ? <div className="loading-state">Loading your dashboard...</div> : error ? <div className="state-box">{error}</div> : <><section className="metric-grid">
        <Metric label="Active orders" value={activeOrders.length} detail={activeOrders.length === 1 ? 'order in progress' : 'orders in progress'} tone="blue" />
        <Metric label="Delivered orders" value={deliveredOrders.length} detail="completed purchases" tone="green" />
        <Metric label="Cart items" value={cartCount} detail={cartCount === 1 ? 'item saved for later' : 'items saved for later'} tone="purple" />
        <Metric label="Cart total" value={formatPrice(cartTotal)} detail="protected checkout total" />
      </section>
      <div className="analytics-grid">
        <section className="workspace-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RECENT ACTIVITY</p>
              <h2>Your orders</h2>
            </div>
            <Link className="text-button" to="/orders">View all orders →</Link>
          </div>
          {orders.length ? <div className="workspace-list">
            {orders.slice(0, 5).map((order) => <div className="workspace-row" key={order.id}>
              <div>
                <strong>Order #{order.id}</strong>
                <p>{formatDate(order.created_at)} · {formatPrice(order.total_amount)}</p>
              </div>
              <span className={`status-pill ${order.status}`}>{order.status}</span>
              <Link className="text-button" to="/orders">Details →</Link>
            </div>)}
          </div> : <div className="workspace-empty">No orders yet. Browse the shop to make your first purchase.</div>}
        </section>
        <section className="workspace-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR SELECTION</p>
              <h2>Cart summary</h2>
            </div>
            <Link className="text-button" to="/cart">Open cart →</Link>
          </div>
          {cart.length ? <div className="workspace-list">
            {cart.slice(0, 5).map((item) => <div className="workspace-row" key={item.product_id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.vendor} · Qty {item.quantity}</p>
              </div>
              <span>{formatPrice(Number(item.price) * Number(item.quantity))}</span>
            </div>)}
          </div> : <div className="workspace-empty">Your cart is empty.</div>}
          {cart.length ? <div className="cart-total"><span>Protected total</span><strong>{formatPrice(cartTotal)}</strong></div> : null}
        </section>
        <section className="workspace-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACCOUNT</p>
              <h2>Shopping profile</h2>
            </div>
          </div>
          <div className="workspace-list">
            <div className="workspace-row">
              <div>
                <strong>{session.user?.name}</strong>
                <p>{session.user?.email}</p>
              </div>
              <span className="status-pill active">Active</span>
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 18 }}>
            <Link className="secondary-button" to="/orders">Order history</Link>
            <Link className="secondary-button" to="/shop">Browse marketplace</Link>
          </div>
        </section>
      </div>
    </>}
  </div>
}
