import { useState } from 'react'
import { login } from '../services/api'
import { saveSession } from '../utils/auth'

function Login({ onAuthenticated, onSwitch }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await login({ email, password })
      saveSession(session)
      onAuthenticated(session)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return <AuthLayout title="Welcome back" subtitle="Sign in to manage your marketplace." onSwitch={onSwitch} switchLabel="Create an account">
    <form onSubmit={handleSubmit}>
      <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required /></label>
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
    </form>
  </AuthLayout>
}

export function AuthLayout({ title, subtitle, onSwitch, switchLabel, children }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="auth-mark">M</span><strong>marketplace<span>.</span></strong></div><p className="auth-kicker">MARKETPLACEOS</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}<p className="auth-switch">{title === 'Welcome back' ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={onSwitch}>{switchLabel}</button></p></section><aside className="auth-aside"><span className="aside-number">01</span><h2>Many makers.<br />One marketplace.</h2><p>Bring independent brands and thoughtful products together in one calm, capable workspace.</p><div className="aside-rule" /></aside></main>
}

export default Login