import { useEffect, useState } from 'react'
import { getEscrowLedger, refundEscrow, releaseEscrow } from '../services/api'

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function Escrow() {
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    getEscrowLedger().then(setLedger).catch((requestError) => setError(requestError.message || 'Could not load escrow ledger')).finally(() => setLoading(false))
  }, [])

  async function action(orderId, type) {
    setWorking(`${type}-${orderId}`)
    try {
      if (type === 'release') await releaseEscrow(orderId)
      if (type === 'refund') await refundEscrow(orderId)
      setNotice(type === 'release' ? 'Escrow released' : 'Escrow refunded')
      getEscrowLedger().then(setLedger)
    } catch (requestError) {
      setNotice(requestError.message || 'Could not update escrow')
    } finally {
      setWorking('')
    }
  }

  const held = ledger.filter((item) => item.status === 'held').reduce((sum, item) => sum + Number(item.amount), 0)
  return <div><div className="page-heading"><div><p className="eyebrow">PAYMENT PROTECTION</p><h1>Escrow ledger</h1><p>Review held, released and refunded marketplace payments.</p></div><div className="metric-card" style={{ maxWidth: 260 }}><div className="metric-top"><span>Held funds</span><span className="metric-icon green">◌</span></div><strong>{formatPrice(held)}</strong><p>{ledger.length} ledger entries</p></div></div>{loading ? <div className="loading-state">Loading escrow ledger...</div> : error ? <div className="state-box">{error}</div> : <div className="workspace-section">{ledger.length ? ledger.map((item) => <article className="escrow-card" key={item.id}><header><div><strong>Order #{item.order_id}</strong><p>{item.customer_name} · {item.vendors}</p></div><span className={`badge ${item.status}`}>{item.status}</span></header><div className="action-row"><span>{formatPrice(item.amount)}</span><small>{item.provider} · {item.reference}</small>{item.status === 'held' && <><button className="primary-button" onClick={() => action(item.order_id, 'release')} disabled={working.startsWith(`release-${item.order_id}`)}>Release</button><button className="danger-button" onClick={() => action(item.order_id, 'refund')} disabled={working.startsWith(`refund-${item.order_id}`)}>Refund</button></>}</div></article>) : <div className="workspace-empty">No escrow transactions yet.</div>}</div>}{notice && <div className="toast" role="status">{notice}</div>}</div>
}
