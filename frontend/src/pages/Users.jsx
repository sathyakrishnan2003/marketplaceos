import { useEffect, useState } from 'react'
import { deleteUser, getUsers, updateUserRole, updateUserStatus } from '../services/api'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    getUsers().then(setUsers).catch((requestError) => setError(requestError.message || 'Could not load users')).finally(() => setLoading(false))
  }, [])

  async function update(id, type, value) {
    setWorking(`${type}-${id}`)
    try {
      if (type === 'status') await updateUserStatus(id, value)
      if (type === 'role') await updateUserRole(id, value)
      if (type === 'delete') await deleteUser(id)
      setNotice(type === 'delete' ? 'User deleted' : 'User updated')
      getUsers().then(setUsers)
    } catch (requestError) {
      setNotice(requestError.message || 'Could not update user')
    } finally {
      setWorking('')
    }
  }

  return <div><div className="page-heading"><div><p className="eyebrow">PLATFORM OPERATIONS</p><h1>User management</h1><p>Protect the community by managing account access and roles.</p></div></div>{loading ? <div className="loading-state">Loading users...</div> : error ? <div className="state-box">{error}</div> : <section className="workspace-section"><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer or vendor</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => update(user.id, 'role', event.target.value)} disabled={working.startsWith(`role-${user.id}`)}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="admin">Admin</option></select></td><td><span className={`status-pill ${user.status}`}>{user.status}</span></td><td>{new Date(user.created_at).toLocaleDateString('en-IN')}</td><td><div className="action-row"><select aria-label={`Status for ${user.name}`} value={user.status} onChange={(event) => update(user.id, 'status', event.target.value)} disabled={working.startsWith(`status-${user.id}`)}><option value="active">Active</option><option value="suspended">Suspended</option></select><button className="danger-button" onClick={() => update(user.id, 'delete')} disabled={working.startsWith(`delete-${user.id}`)}>Delete</button></div></td></tr>)}</tbody></table></div></section>}{notice && <div className="toast" role="status">{notice}</div>}</div>
}
