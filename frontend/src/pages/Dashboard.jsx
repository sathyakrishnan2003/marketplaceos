import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnalyticsSummary, getAnalyticsTimeSeries, getTopCategories, getTopProducts, getVendorAnalytics, getVendorPerformance, getVendorProducts, getVendorTimeSeries } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function Metric({ label, value, detail, tone = 'orange' }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>↗</span></div><strong>{value}</strong><p><span className="trend up">Live</span> <span>{detail}</span></p></article>
}

function Chart({ series, dataKey, label }) {
  const values = (series || []).map((item) => Number(item[dataKey] || 0))
  const max = Math.max(...values, 1)
  return <div className="chart-card"><div className="panel-heading"><div><p className="eyebrow">REAL-TIME DATA</p><h2>{label}</h2><p>Latest activity from the marketplace API</p></div></div><div className="chart-summary"><strong>{formatPrice(values.reduce((sum, value) => sum + value, 0))}</strong><span>Period total</span></div><div className="chart" aria-label={`${label} chart`}>{values.map((value, index) => <span className="chart-bar" key={`${series[index].date}-${index}`} style={{ height: `${Math.max(5, (value / max) * 100)}%`, title: `${series[index].date}: ${formatPrice(value)}` }} />)}</div></div>
}

export default function Dashboard({ session, analyticsOnly = false }) {
  const role = session.user?.role
  const isAdmin = role === 'admin'
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [topCategories, setTopCategories] = useState([])
  const [vendorPerformance, setVendorPerformance] = useState([])
  const [vendorProducts, setVendorProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const requests = isAdmin
      ? [getAnalyticsSummary(), getAnalyticsTimeSeries('30d'), getTopProducts(), getTopCategories(), getVendorPerformance()]
      : [getVendorAnalytics(), getVendorTimeSeries('30d'), getVendorProducts()]
    Promise.all(requests).then((data) => {
      if (isAdmin) {
        const [nextSummary, nextSeries, nextTopProducts, nextTopCategories, nextPerformance] = data
        setSummary(nextSummary)
        setSeries(nextSeries.series || [])
        setTopProducts(nextTopProducts)
        setTopCategories(nextTopCategories)
        setVendorPerformance(nextPerformance)
      } else {
        const [nextSummary, nextSeries, nextProducts] = data
        setSummary(nextSummary)
        setSeries(nextSeries.series || [])
        setVendorProducts(nextProducts)
      }
    }).catch((requestError) => setError(requestError.message || 'Could not load dashboard')).finally(() => setLoading(false))
  }, [isAdmin])

  if (loading) return <div className="loading-state">Loading workspace...</div>
  if (error) return <div className="state-box">{error}</div>

  return <div>
    <div className="page-heading"><div><p className="eyebrow">{isAdmin ? 'PLATFORM OVERVIEW' : 'SELLER OVERVIEW'}</p><h1>{isAdmin ? `Good morning, ${session.user?.name?.split(' ')[0] || 'Admin'}` : 'Your storefront at a glance'}</h1><p>{isAdmin ? 'Here is what is happening across your marketplace today.' : 'Track products, orders and earnings in one place.'}</p></div>{!analyticsOnly && role === 'vendor' && <Link className="primary-button" to="/add-product">＋ Add product</Link>}</div>
    {isAdmin ? <><section className="metric-grid"><Metric label="Gross merchandise value" value={formatPrice(summary?.summary?.gross_merchandise_value)} detail="all-time marketplace" /><Metric label="Orders this month" value={Number(summary?.summary?.total_orders || 0).toLocaleString('en-IN')} detail="all marketplace orders" tone="blue" /><Metric label="In escrow" value={formatPrice(summary?.escrow?.amount)} detail={`${summary?.escrow?.orders || 0} orders awaiting delivery`} tone="green" /><Metric label="Active vendors" value={summary?.vendors?.active_vendors || 0} detail="approved vendors" tone="purple" /></section><div className="analytics-grid"><Chart series={series} dataKey="gmv" label="Sales overview" /><section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">TOP PRODUCTS</p><h2>Best performers</h2></div></div><div className="workspace-list">{topProducts.slice(0, 5).map((product) => <div className="workspace-row" key={product.id}><div><strong>{product.name}</strong><p>{product.vendor}</p></div><span>{product.units_sold || 0} sold</span></div>)}</div></section><section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">TOP CATEGORIES</p><h2>Category performance</h2></div></div><div className="workspace-list">{topCategories.slice(0, 5).map((category) => <div className="workspace-row" key={category.id}><div><strong>{category.name}</strong><p>{category.products} products</p></div><span>{formatPrice(category.revenue)}</span></div>)}</div></section><section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">VENDOR NETWORK</p><h2>Vendor performance</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Vendor</th><th>Status</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{vendorPerformance.slice(0, 8).map((vendor) => <tr key={vendor.id}><td><strong>{vendor.business_name}</strong></td><td><span className={`status-pill ${vendor.status}`}>{vendor.status}</span></td><td>{vendor.orders || 0}</td><td>{formatPrice(vendor.revenue)}</td></tr>)}</tbody></table></div></section></div></> : <><section className="metric-grid"><Metric label="Your revenue" value={formatPrice(summary?.summary?.revenue)} detail="from your products" /><Metric label="Orders" value={Number(summary?.summary?.orders || 0).toLocaleString('en-IN')} detail="customer orders" tone="blue" /><Metric label="Held in escrow" value={formatPrice(summary?.escrow?.amount)} detail="sandbox protection" tone="green" /><Metric label="Active listings" value={summary?.products?.active_products || 0} detail="in your storefront" tone="purple" /></section><div className="analytics-grid"><Chart series={series} dataKey="revenue" label="Your sales overview" /><section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">YOUR CATALOG</p><h2>Active listings</h2></div><Link className="text-button" to="/vendor/products">View catalog →</Link></div><div className="workspace-list">{vendorProducts.slice(0, 6).map((product) => <div className="workspace-row" key={product.id}><div><strong>{product.name}</strong><p>{product.category} · {product.stock} in stock</p></div><span>{formatPrice(product.price)}</span></div>)}</div></section></div></>}
  </div>
}
