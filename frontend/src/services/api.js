const API_URL = import.meta.env.VITE_API_URL || '/api'
const REFRESH_KEY = 'marketplace_refresh_token'

import { clearSession, saveSession } from '../utils/auth.js'

class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) throw new ApiError('Your session has expired', 401, 'TOKEN_EXPIRED')
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  })
  const data = await readJson(response)
  if (!response.ok) throw new ApiError(data.message || 'Your session has expired', response.status, data.code)
  saveSession({ token: data.token, refresh_token: refreshToken, user: data.user })
  window.dispatchEvent(new CustomEvent('marketplace:session', { detail: { token: data.token, user: data.user } }))
  return data
}

async function request(path, options = {}) {
  const token = localStorage.getItem('marketplace_token')
  const { headers: optionHeaders, ...requestOptions } = options
  const isFormData = requestOptions.body instanceof FormData
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(token),
    ...optionHeaders
  }
  let response
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers })
  } catch {
    // A network-level failure here means the API is unreachable, which is very
    // different from rejected credentials. Say which, so a login attempt does
    // not look like a wrong password.
    throw new ApiError(
      `Could not reach the server at ${API_URL}. Check that the backend is running.`,
      0,
      'API_UNREACHABLE'
    )
  }
  if (response.status === 401 && path !== '/auth/refresh' && !path.startsWith('/auth/')) {
    try {
      await refreshAccessToken()
      const refreshedToken = localStorage.getItem('marketplace_token')
      const refreshedHeaders = {
        ...headers,
        ...authHeaders(refreshedToken)
      }
      response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers: refreshedHeaders })
    } catch (refreshError) {
      clearSession()
      if (refreshError instanceof ApiError && refreshError.code === 'API_UNREACHABLE') throw refreshError
      throw new ApiError(
        `Could not reach the server at ${API_URL}. Check that the backend is running.`,
        0,
        'API_UNREACHABLE'
      )
    }
  }
  const data = await readJson(response)
  if (!response.ok) throw new ApiError(data.message || 'Request failed', response.status, data.code)
  return data
}

export const login = (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
export const register = (details) => request('/auth/register', { method: 'POST', body: JSON.stringify(details) })
export const logout = async () => {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  try {
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })
  } finally {
    clearSession()
  }
}
export const getMe = () => request('/auth/me')
export const getProducts = () => request('/products')
export const getProduct = (id) => request(`/products/${id}`)
export const getVendorProducts = () => request('/products/mine')
export const getCategories = () => request('/categories')
export const createCategory = (details) => request('/categories', { method: 'POST', body: JSON.stringify(details) })
export const updateCategory = (id, details) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(details) })
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' })
export const getVendors = () => request('/vendors')
export const getVendor = (id) => request(`/vendors/${id}`)
export const getAllVendors = () => request('/vendors/admin/all')
export const approveVendor = (id) => request(`/vendors/admin/${id}/approve`, { method: 'POST' })
export const suspendVendor = (id) => request(`/vendors/admin/${id}/suspend`, { method: 'POST' })
export const updateVendorStatus = (id, status) => request(`/vendors/admin/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
export const getUsers = () => request('/users')
export const updateUserStatus = (id, status) => request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
export const updateUserRole = (id, role) => request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
export const deleteUser = (id) => request(`/users/${id}`, { method: 'DELETE' })
export const getCart = () => request('/cart')
export const addToCart = (productId, quantity = 1) => request('/cart', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity }) })
export const removeFromCart = (productId) => request(`/cart/${productId}`, { method: 'DELETE' })
export const getOrders = () => request('/orders')
export const getOrder = (id) => request(`/orders/${id}`)
export const getVendorOrders = () => request('/orders/vendor/mine')
export const createOrder = (idempotencyKey) => request('/orders', { method: 'POST', body: JSON.stringify({ idempotency_key: idempotencyKey || `checkout_${Date.now()}` }) })
export const confirmDelivery = (orderId) => request(`/orders/${orderId}/confirm-delivery`, { method: 'POST' })
export const shipOrder = (orderId, trackingNumber = '') => request(`/orders/${orderId}/ship`, { method: 'POST', body: JSON.stringify({ tracking_number: trackingNumber }) })
export const cancelOrder = (orderId) => request(`/orders/${orderId}/cancel`, { method: 'POST' })
export const refundOrder = (orderId) => request(`/orders/${orderId}/refund`, { method: 'POST' })
export const getEscrowLedger = () => request('/orders/admin/escrow')
export const releaseEscrow = (orderId) => request(`/orders/admin/escrow/${orderId}/release`, { method: 'POST' })
export const refundEscrow = (orderId) => request(`/orders/admin/escrow/${orderId}/refund`, { method: 'POST' })
export const createProduct = (details) => request('/products', { method: 'POST', body: details })
export const getProductReviews = (productId, page = 1) => request(`/reviews/product/${productId}?page=${page}&limit=20`)
export const getProductRating = (productId) => request(`/reviews/product/${productId}/rating`)
export const createReview = (review) => request('/reviews', { method: 'POST', body: JSON.stringify(review) })
export const getAnalyticsSummary = () => request('/analytics/summary')
export const getVendorSummary = () => request('/analytics/vendor')
export const getAnalyticsTimeSeries = (range = '30d') => request(`/analytics/summary/time-series?range=${range}`)
export const getTopProducts = () => request('/analytics/summary/top-products')
export const getTopCategories = () => request('/analytics/summary/top-categories')
export const getVendorPerformance = () => request('/analytics/summary/vendor-performance')
export const getVendorAnalytics = () => request('/analytics/vendor')
export const getVendorTimeSeries = (range = '30d') => request(`/analytics/vendor/time-series?range=${range}`)

export { ApiError }

export const API_BASE_URL = API_URL

// VITE_API_URL points at the API mount point (e.g. https://host/api), but
// uploads are served from the host root, so the /api segment is dropped here.
export const ORIGIN_URL = API_URL.replace(/\/api\/?$/, '')

export function uploadUrl(image) {
  if (!image) return null
  if (image.startsWith('/uploads')) return `${ORIGIN_URL}${image}`
  return image
}

export async function checkApiHealth() {
  const base = API_URL.replace(/\/api\/?$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${base}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
