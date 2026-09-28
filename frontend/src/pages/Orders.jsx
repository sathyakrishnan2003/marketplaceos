import { useEffect, useState } from 'react'
import { cancelOrder, confirmDelivery, getOrders, getVendorOrders, shipOrder } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function formatDate(value) {
  if (!value || value === 'demo') return 'Just now'
  return new Date(value).toLocaleDateString('en-IN')
}

export default function Orders({ session }) {
  const role = session.user?.role
  const isVendor = role === 'vendor'
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tracking, setTracking] = useState({})
  const [working, setWorking] = useState('')

  useEffect(() => {
    ;(isVendor ? getVendorOrders() : getOrders()).then(setOrders).catch((requestError) => setError(requestError.message || 'Could not load orders')).finally(() => setLoading(false))
  }, [isVendor])

  async function action(orderId, type) {
    setWorking(orderId)
    setError('')
    try {
      if (type === 'deliver') await confirmDelivery(orderId)
      if (type === 'cancel') await cancelOrder(orderId)
      if (type === 'ship') await shipOrder(orderId, tracking[orderId] || '')
      setNotice(type === 'deliver' ? 'Delivery confirmed and escrow released' : type === 'cancel' ? 'Order cancelled' : 'Order marked as shipped')
      ;(isVendor ? getVendorOrders() : getOrders()).then(setOrders)
    } catch (requestError) {
      setError(requestError.message || 'Could not update order')
    } finally {
      setWorking('')
    }
  }

  return <main className="customer-orders"><button className="back-button" onClick={() => window.history.back()}>← Back</button><p className="eyebrow">{isVendor ? 'SELLER WORKSPACE' : 'YOUR MARKETPLACE'}</p><h1>{isVendor ? 'Orders & fulfillment' : 'Orders & delivery'}</h1><p className="orders-intro">{isVendor ? 'Review customer orders and share tracking when items are dispatched.' : 'Your payment stays protected in escrow until you confirm delivery.'}</p>{loading ? <div className="loading-state">Loading orders...</div> : error ? <div className="state-box">{error}</div> : <section className="orders-list">{orders.length ? orders.map((order) => <article className="order-card" key={order.id}><div><span className="order-label">ORDER #{order.id}</span><h2>{formatPrice(order.total_amount)}</h2><p>{formatDate(order.created_at)} · {order.vendor_items ? `${order.vendor_items} item${order.vendor_items === 1 ? '' : 's'} from your store` : 'Protected payment'}</p></div><div className="order-state"><span className={`status-pill ${order.status}`}>{order.status}</span>{isVendor && order.status === 'paid' && <><input aria-label="Tracking number" placeholder="Tracking number" value={tracking[order.id] || ''} onChange={(event) => setTracking({ ...tracking, [order.id]: event.target.value })} /><button className="primary-button" onClick={() => action(order.id, 'ship')} disabled={working === order.id}>{working === order.id ? 'Saving...' : 'Mark shipped'}</button></>}{!isVendor && order.escrow_status === 'held' && <button className="primary-button" onClick={() => action(order.id, 'deliver')} disabled={working === order.id}>Confirm delivery</button>}{!isVendor && ['paid', 'shipped'].includes(order.status) && <button className="secondary-button" onClick={() => action(order.id, 'cancel')} disabled={working === order.id}>Cancel</button>}</div></article>) : <div className="workspace-empty">No orders yet.</div>}</section>}{notice && <div className="toast" role="status">{notice}</div>}</main>
}
