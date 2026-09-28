import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approveVendor, getAllVendors, getVendor, getVendors, suspendVendor, updateVendorStatus } from '../services/api'

function imageUrl(image) {
  if (!image) return null
  if (image.startsWith('/uploads')) return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${image}`
  return image
}

export default function Vendors({ admin = false }) {
  const { id } = useParams()
  const [vendors, setVendors] = useState([])
  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    const request = admin ? getAllVendors() : id ? getVendor(id) : getVendors()
    request.then((data) => {
      if (id) setVendor(data)
      else setVendors(data)
    }).catch((requestError) => setError(requestError.message || 'Could not load vendors')).finally(() => setLoading(false))
  }, [id, admin])

  async function update(idValue, type) {
    setWorking(`${type}-${idValue}`)
    try {
      if (type === 'approve') await approveVendor(idValue)
      if (type === 'suspend') await suspendVendor(idValue)
      if (type === 'status') await updateVendorStatus(idValue, 'approved')
      setNotice('Vendor updated')
      const data = await getAllVendors()
      setVendors(data)
      if (vendor && String(vendor.id) === String(idValue)) setVendor({ ...vendor, status: type === 'suspend' ? 'suspended' : 'approved' })
    } catch (requestError) {
      setNotice(requestError.message || 'Could not update vendor')
    } finally {
      setWorking('')
    }
  }

  if (loading) return <div className="public-page"><div className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace.</span></Link></div><div className="loading-state">Loading vendors...</div></div>
  if (error && !vendor && !vendors.length) return <div className="public-page"><div className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace.</span></Link></div><div className="state-box">{error}</div></div>

  if (!admin && vendor) return <div className="public-page"><header className="public-header"><Link className="brand" to="/shop"><span className="brand-mark">M</span><span>marketplace<span className="brand-dot">.</span></span></Link><nav><Link to="/shop">Back to shop</Link><Link to="/vendors">All vendors</Link></nav></header><main className="public-grid"><section className="vendor-hero"><p className="eyebrow">INDEPENDENT MAKER</p><h1>{vendor.business_name}</h1><p>{vendor.description || 'Thoughtful products from an independent maker.'}</p></section><h2 className="shop-heading"><span>Storefront</span><span>{vendor.products?.length || 0} products</span></h2><div className="vendor-products">{vendor.products?.map((product) => <Link className="public-card" to={`/products/${product.id}`} key={product.id}><div className="product-art"><img src={imageUrl(product.image)} alt={product.name} /></div><div className="product-info"><h3>{product.name}</h3><p>{product.description}</p><div className="product-meta"><strong>₹{Number(product.price).toLocaleString('en-IN')}</strong><span>★ {Number(product.rating || 0).toFixed(1)}</span></div></div></Link>)}</div></main></div>

  return <div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">{admin ? 'PLATFORM OPERATIONS' : 'MAKER NETWORK'}</p><h1>{admin ? 'Vendor management' : 'Independent vendors'}</h1><p>{admin ? 'Review, approve and protect the seller network.' : 'Meet the makers behind the marketplace.'}</p></div></div>{loading ? <div className="loading-state">Loading vendors...</div> : error ? <div className="state-box">{error}</div> : <div className="workspace-section"><div className="table-wrap"><table className="data-table"><thead><tr><th>Vendor</th><th>Owner</th><th>Products</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{vendors.map((item) => <tr key={item.id}><td><strong>{item.business_name}</strong><small>{item.description}</small></td><td>{item.owner_name || '—'}</td><td>{item.product_count || vendor?.products?.length || 0}</td><td><span className={`status-pill ${item.status}`}>{item.status}</span></td><td>{new Date(item.created_at).toLocaleDateString('en-IN')}</td><td><div className="action-row">{admin && item.status !== 'approved' && <button className="primary-button" onClick={() => update(item.id, 'approve')} disabled={working.startsWith('approve')}>Approve</button>}{admin && item.status !== 'suspended' && <button className="danger-button" onClick={() => update(item.id, 'suspend')} disabled={working.startsWith('suspend')}>Suspend</button>}{!admin && <Link className="text-button" to={`/vendors/${item.id}`}>View storefront →</Link>}</div></td></tr>)}</tbody></table></div></div>}{notice && <div className="toast" role="status">{notice}</div>}</div>
}
