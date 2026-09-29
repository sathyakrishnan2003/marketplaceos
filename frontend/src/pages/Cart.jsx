import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder, getCart, removeFromCart, uploadUrl } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getCart().then(setItems).catch((requestError) => setError(requestError.message || 'Could not load cart')).finally(() => setLoading(false))
  }, [])

  async function remove(productId) {
    try {
      await removeFromCart(productId)
      setItems((current) => current.filter((item) => item.product_id !== productId))
    } catch (requestError) {
      setNotice(requestError.message || 'Could not remove item')
    }
  }

  async function checkout() {
    setCheckingOut(true)
    setError('')
    try {
      const order = await createOrder()
      setNotice(`Order #${order.id} placed`)
      window.setTimeout(() => navigate('/orders'), 700)
    } catch (requestError) {
      setError(requestError.message || 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
  return <main className="customer-cart"><div className="customer-cart-head"><div><p className="eyebrow">YOUR SELECTION</p><h2>Cart</h2></div><button onClick={() => navigate(-1)}>×</button></div>{loading ? <div className="loading-state">Loading cart...</div> : error ? <div className="state-box">{error}</div> : items.length === 0 ? <div className="cart-empty">Your cart is empty.<br />Visit the shop to find something thoughtful.</div> : <><div className="customer-cart-items">{items.map((item) => <div className="customer-cart-item" key={item.product_id}><img className="cart-thumb" src={uploadUrl(item.image)} alt={item.name} /><div><strong>{item.name}</strong><small>{item.vendor}</small><b>{formatPrice(Number(item.price) * Number(item.quantity))}</b></div><button onClick={() => remove(item.product_id)}>×</button></div>)}</div><div className="cart-total"><span>Protected total</span><strong>{formatPrice(total)}</strong></div><button className="primary-button checkout" onClick={checkout} disabled={checkingOut}>{checkingOut ? 'Placing order...' : 'Go to checkout →'}</button></>}{notice && <div className="toast" role="status">{notice}</div>}</main>
}
