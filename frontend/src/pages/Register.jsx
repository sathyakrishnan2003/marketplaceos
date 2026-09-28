import { useState } from 'react'
import { register } from '../services/api'
import { AuthLayout } from './Login'

function Register({ onSwitch }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', business_name: '', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })
  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      onSwitch()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }
  return <AuthLayout title="Join the marketplace" subtitle="Create your account and get started." onSwitch={onSwitch} switchLabel="Sign in">
    <form onSubmit={handleSubmit}><label>Full name<input value={form.name} onChange={update('name')} placeholder="Your name" required /></label><label>Email address<input type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required /></label><label>Password<input type="password" value={form.password} onChange={update('password')} placeholder="At least 6 characters" minLength="6" required /></label><label>Account type<select value={form.role} onChange={update('role')}><option value="customer">Customer</option><option value="vendor">Vendor</option></select></label>{form.role === 'vendor' && <><label>Business name<input value={form.business_name} onChange={update('business_name')} placeholder="Your storefront name" required /></label><label>Business description<textarea rows="3" value={form.description} onChange={update('description')} placeholder="Tell customers what you make" /></label></>}{error && <p className="auth-error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button></form>
  </AuthLayout>
}

export default Register