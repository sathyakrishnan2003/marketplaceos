import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import './customer.css'
import './workspace.css'
import './pages.css'
import { getSession, clearSession } from './utils/auth'
import { logout } from './services/api'
import Login from './pages/Login'
import Register from './pages/Register'
import AddProduct from './pages/AddProduct'
import Products from './pages/Products'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import Vendors from './pages/Vendors'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Escrow from './pages/Escrow'
import Categories from './pages/Categories'
import VendorProducts from './pages/VendorProducts'
import CustomerDashboard from './pages/CustomerDashboard'

function homeForRole(role) {
  if (role === 'vendor') return '/vendor'
  if (role === 'admin') return '/admin'
  if (role === 'customer') return '/customer'
  return '/shop'
}

function ProtectedRoute({ session, roles, children }) {
  if (!session) return <Navigate to="/login" replace />
  if (roles && !roles.includes(session.user?.role)) return <Navigate to={homeForRole(session.user?.role)} replace />
  return children
}

function AppLayout({ session, onSignOut, children }) {
  const location = useLocation()
  const role = session.user?.role
  const workspaceLabel = role === 'admin' ? 'PLATFORM WORKSPACE' : role === 'vendor' ? 'SELLER WORKSPACE' : 'CUSTOMER WORKSPACE'
  const workspaceName = role === 'admin' ? 'MarketplaceOS' : role === 'vendor' ? 'Vendor studio' : 'Customer account'
  const workspaceSubtitle = role === 'admin' ? 'Admin workspace' : role === 'vendor' ? 'Seller workspace' : 'Shopping workspace'
  const navItems = role === 'admin'
    ? [
        ['/admin', 'Overview', '◈'],
        ['/admin/users', 'Users', '♧'],
        ['/admin/vendors', 'Vendors', '□'],
        ['/admin/categories', 'Categories', '▣'],
        ['/admin/escrow', 'Escrow', '◌'],
        ['/admin/analytics', 'Analytics', '↗']
      ]
    : role === 'vendor'
      ? [
          ['/vendor', 'Overview', '◈'],
          ['/vendor/products', 'Products', '□'],
          ['/vendor/orders', 'Orders', '↗'],
          ['/add-product', 'Add product', '＋']
        ]
      : [
          ['/customer', 'Overview', '◈'],
          ['/cart', 'Cart', '▣'],
          ['/orders', 'Orders', '↗'],
          ['/shop', 'Shop', '→']
        ]

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>marketplace<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">{workspaceLabel}</div>
      <div className="workspace-switcher"><span className="workspace-avatar">{session.user?.name?.slice(0, 2).toUpperCase() || 'M'}</span><span><strong>{workspaceName}</strong><small>{workspaceSubtitle}</small></span></div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navItems.map(([to, label, icon]) => <NavLink key={to} to={to} className={() => `nav-item${location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to)) ? ' active' : ''}`}><span className="nav-icon">{icon}</span>{label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="user-card" onClick={onSignOut}><span className="user-avatar">{session.user?.name?.slice(0, 2).toUpperCase() || 'M'}</span><span><strong>{session.user?.name || 'User'}</strong><small>{role} · Sign out</small></span></button>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{navItems.find(([to]) => location.pathname === to || location.pathname.startsWith(to))?.[1] || 'Overview'}</strong></div><div className="top-actions"><span className="live-indicator">Live</span><button className="help-button" onClick={onSignOut}>Sign out</button></div></header>
      <section className="content-wrap">{children}</section>
    </main>
  </div>
}

function WorkspaceRoute({ session, onSignOut, roles, children }) {
  return <ProtectedRoute session={session} roles={roles}><AppLayout session={session} onSignOut={onSignOut}>{children}</AppLayout></ProtectedRoute>
}

function App() {
  const [session, setSession] = useState(() => getSession())
  const navigate = useNavigate()

  useEffect(() => {
    const handleSession = (event) => setSession(event.detail)
    window.addEventListener('marketplace:session', handleSession)
    return () => window.removeEventListener('marketplace:session', handleSession)
  }, [])

  const handleAuthenticated = (nextSession) => {
    setSession(nextSession)
    navigate(homeForRole(nextSession.user?.role), { replace: true })
  }

  const handleSignOut = async () => {
    try {
      await logout()
    } finally {
      clearSession()
      setSession(null)
      navigate('/login', { replace: true })
    }
  }

  return <Routes>
    <Route path="/login" element={session ? <Navigate to={homeForRole(session.user?.role)} replace /> : <Login onAuthenticated={handleAuthenticated} onSwitch={() => navigate('/register')} />} />
    <Route path="/register" element={session ? <Navigate to={homeForRole(session.user?.role)} replace /> : <Register onSwitch={() => navigate('/login')} />} />
    <Route path="/" element={<Navigate to={session ? homeForRole(session.user?.role) : '/shop'} replace />} />
    <Route path="/shop" element={<Products session={session} onSignOut={handleSignOut} />} />
    <Route path="/customer" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['customer']}><CustomerDashboard session={session} /></WorkspaceRoute>} />
    <Route path="/products" element={<Navigate to="/shop" replace />} />
    <Route path="/products/:id" element={<ProductDetails session={session} onSignOut={handleSignOut} />} />
    <Route path="/vendors" element={<Vendors />} />
    <Route path="/vendors/:id" element={<Vendors />} />
    <Route path="/cart" element={<ProtectedRoute session={session} roles={['customer']}><Cart session={session} /></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute session={session} roles={['customer']}><Orders session={session} /></ProtectedRoute>} />
    <Route path="/add-product" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['vendor']}><AddProduct onBack={() => navigate('/vendor/products')} /></WorkspaceRoute>} />
    <Route path="/vendor" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['vendor']}><Dashboard session={session} /></WorkspaceRoute>} />
    <Route path="/vendor/products" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['vendor']}><VendorProducts /></WorkspaceRoute>} />
    <Route path="/vendor/orders" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['vendor']}><Orders session={session} /></WorkspaceRoute>} />
    <Route path="/admin" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Dashboard session={session} /></WorkspaceRoute>} />
    <Route path="/admin/users" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Users /></WorkspaceRoute>} />
    <Route path="/admin/vendors" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Vendors admin /></WorkspaceRoute>} />
    <Route path="/admin/categories" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Categories /></WorkspaceRoute>} />
    <Route path="/admin/escrow" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Escrow /></WorkspaceRoute>} />
    <Route path="/admin/analytics" element={<WorkspaceRoute session={session} onSignOut={handleSignOut} roles={['admin']}><Dashboard session={session} analyticsOnly /></WorkspaceRoute>} />
    <Route path="*" element={<Navigate to={session ? homeForRole(session.user?.role) : '/shop'} replace />} />
  </Routes>
}

export default App
