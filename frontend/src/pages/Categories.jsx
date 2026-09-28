import { useEffect, useState } from 'react'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../services/api'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    getCategories().then(setCategories).catch((requestError) => setError(requestError.message || 'Could not load categories')).finally(() => setLoading(false))
  }, [])

  async function submit(event) {
    event.preventDefault()
    setWorking('save')
    setError('')
    try {
      if (editing) await updateCategory(editing.id, form)
      else await createCategory(form)
      setNotice(editing ? 'Category updated' : 'Category created')
      setForm({ name: '', description: '' })
      setEditing(null)
      getCategories().then(setCategories)
    } catch (requestError) {
      setError(requestError.message || 'Could not save category')
    } finally {
      setWorking('')
    }
  }

  async function remove(category) {
    setWorking(`delete-${category.id}`)
    try {
      await deleteCategory(category.id)
      setNotice('Category deleted')
      getCategories().then(setCategories)
    } catch (requestError) {
      setNotice(requestError.message || 'Could not delete category')
    } finally {
      setWorking('')
    }
  }

  function startEdit(category) {
    setEditing(category)
    setForm({ name: category.name, description: category.description || '' })
  }

  return <div><div className="page-heading"><div><p className="eyebrow">PLATFORM OPERATIONS</p><h1>Category management</h1><p>Organize the catalog with searchable, reusable product categories.</p></div></div><div className="split-layout"><form className="workspace-section" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">{editing ? 'EDIT CATEGORY' : 'NEW CATEGORY'}</p><h2>{editing ? 'Edit category' : 'Add category'}</h2></div></div><div className="form-grid"><div className="form-row"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label></div><div className="form-row"><label>Description<textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div></div><div className="action-row"><button className="primary-button" disabled={working === 'save'}>{working === 'save' ? 'Saving...' : editing ? 'Update category' : 'Create category'}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ name: '', description: '' }) }}>Cancel</button>}</div>{error && <div className="state-box">{error}</div>}</form><section className="workspace-section"><div className="panel-heading"><div><p className="eyebrow">CATALOG STRUCTURE</p><h2>Existing categories</h2></div><span className="workspace-summary">{categories.length} categories</span></div>{loading ? <div className="loading-state">Loading categories...</div> : <div className="workspace-list">{categories.map((category) => <div className="category-card" key={category.id}><div><strong>{category.name}</strong><p>{category.description || 'No description'}</p></div><div className="action-row"><button className="text-button" onClick={() => startEdit(category)}>Edit</button><button className="danger-button" onClick={() => remove(category)} disabled={working.startsWith(`delete-${category.id}`)}>Delete</button></div></div>)}</div>}</section></div>{notice && <div className="toast" role="status">{notice}</div>}</div>
}
