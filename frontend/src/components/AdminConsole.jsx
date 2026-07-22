import React, { useState, useEffect } from 'react'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchSystemGeminiKey,
  updateSystemGeminiKey,
  updateProfile
} from '../api/client'

export default function AdminConsole({ onLogout }) {
  const [customers, setCustomers] = useState([])
  const [systemKey, setSystemKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // Customer Form State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)

  // Admin Profile State
  const [adminUsername, setAdminUsername] = useState(() => localStorage.getItem('username') || '')
  const [adminName, setAdminName] = useState(() => localStorage.getItem('name') || '')
  const [adminPassword, setAdminPassword] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const custData = await fetchCustomers()
      const keyData = await fetchSystemGeminiKey()
      setCustomers(custData)
      setSystemKey(keyData.key || '')
    } catch (e) {
      console.error(e)
      setMessage({ success: false, text: 'Failed to load administrative console data.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault()
    if (!username.trim()) {
      setMessage({ success: false, text: 'Username is required.' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      if (editId) {
        // Update customer
        const payload = { name: name.trim(), username: username.trim() }
        if (password.trim()) payload.password = password.trim()
        await updateCustomer(editId, payload)
        setMessage({ success: true, text: 'Customer profile updated successfully.' })
      } else {
        // Create customer
        if (!password.trim()) {
          setMessage({ success: false, text: 'Password is required for new customer.' })
          setActionLoading(false)
          return
        }
        await createCustomer({
          username: username.trim(),
          password: password.trim(),
          name: name.trim()
        })
        setMessage({ success: true, text: 'Customer profile created successfully.' })
      }
      // Reset form
      setUsername('')
      setPassword('')
      setName('')
      setEditId(null)
      loadData()
    } catch (err) {
      setMessage({ success: false, text: err.message || 'Failed to complete action.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditInit = (cust) => {
    setEditId(cust.id)
    setUsername(cust.username)
    setName(cust.name || '')
    setPassword('')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will permanently wipe out their entire transaction logs, holdings, and watchlists.')) {
      return
    }
    setActionLoading(true)
    try {
      await deleteCustomer(id)
      setMessage({ success: true, text: 'Customer account and associated data terminated successfully.' })
      loadData()
    } catch (e) {
      setMessage({ success: false, text: 'Failed to delete customer.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateKey = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setMessage(null)
    try {
      await updateSystemGeminiKey(systemKey.trim())
      setMessage({ success: true, text: 'System default Gemini API Key updated.' })
    } catch (e) {
      setMessage({ success: false, text: 'Failed to update system Gemini key.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateAdminProfile = async (e) => {
    e.preventDefault()
    if (!adminUsername.trim()) {
      setMessage({ success: false, text: 'Admin username cannot be blank.' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      const payload = { username: adminUsername.trim(), name: adminName.trim() }
      if (adminPassword.trim()) payload.password = adminPassword.trim()
      const res = await updateProfile(payload)
      localStorage.setItem('username', res.username)
      localStorage.setItem('name', res.name)
      setAdminUsername(res.username)
      setAdminName(res.name)
      setAdminPassword('')
      setMessage({ success: true, text: 'Admin profile credentials updated successfully.' })
    } catch (err) {
      setMessage({ success: false, text: err.message || 'Failed to update admin profile.' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Panel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '40px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '20px'
      }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '32px', marginBottom: '8px' }}>Admin Console</h1>
          <p style={{ color: 'var(--text-secondary)' }}>System administration dashboard and customer directory</p>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.1)',
            color: 'var(--accent-rose)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'var(--transition-smooth)'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(244, 63, 94, 0.2)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(244, 63, 94, 0.1)'}
        >
          Sign Out
        </button>
      </div>

      {message && (
        <div style={{
          background: message.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${message.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
          borderRadius: '12px',
          padding: '16px',
          color: message.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          fontSize: '15px',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '32px',
        alignItems: 'start'
      }}>
        {/* Left Column: Customers List & Global settings */}
        <div>
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: '#fff' }}>Customer Directory</h3>
            
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>Loading directory details...</div>
            ) : customers.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>No customer profiles configured yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <th style={{ padding: '12px 8px' }}>Customer Name</th>
                    <th style={{ padding: '12px 8px' }}>Username</th>
                    <th style={{ padding: '12px 8px' }}>Logins</th>
                    <th style={{ padding: '12px 8px' }}>AI Requests</th>
                    <th style={{ padding: '12px 8px' }}>AI Overrides</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => (
                    <tr key={cust.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '16px 8px', fontWeight: 600, color: '#fff' }}>
                        {cust.name || 'Unnamed Client'} {cust.admin && <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-indigo)', marginLeft: '6px' }}>Admin</span>}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{cust.username}</td>
                      <td style={{ padding: '16px 8px', color: 'var(--accent-cyan)', fontWeight: '700' }}>{cust.loginCount || 0}</td>
                      <td style={{ padding: '16px 8px', color: 'var(--accent-indigo)', fontWeight: '700' }}>{cust.aiRequestCount || 0}</td>
                      <td style={{ padding: '16px 8px' }}>
                        {cust.customGeminiApiKey ? (
                          <span style={{ color: 'var(--accent-emerald)', fontSize: '13px' }}>Custom Key Saved</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Using System Default</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        {!cust.admin && (
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditInit(cust)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                color: 'var(--accent-indigo)',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(cust.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: 'var(--accent-rose)',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Settings Section */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#fff' }}>Global AI Orchestrator</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
                Define the default fallback Gemini API Key. Shared across all clients unless overridden by their profile.
              </p>
              
              <form onSubmit={handleUpdateKey}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                    Default System Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={systemKey}
                    onChange={(e) => setSystemKey(e.target.value)}
                    placeholder="AI Key (AIzaSy...)"
                    disabled={actionLoading}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4f46e5 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow)'
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Save Default Key'}
                </button>
              </form>
            </div>

            {/* Admin Profile Section */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#fff' }}>Admin Profile Settings</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
                Update your administrative login username credentials and dashboard passwords below.
              </p>
              
              <form onSubmit={handleUpdateAdminProfile}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
                    Admin Username
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    disabled={actionLoading}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Admin name"
                    disabled={actionLoading}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="New password (optional)"
                    disabled={actionLoading}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4f46e5 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow)'
                  }}
                >
                  {actionLoading ? 'Updating...' : 'Update Admin Credentials'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '20px', color: '#fff' }}>
            {editId ? 'Modify Customer Profile' : 'Register New Customer'}
          </h3>
          
          <form onSubmit={handleCreateOrUpdate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
                Username / Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. client_alpha"
                disabled={actionLoading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
                Password {editId && '(leave blank to keep current)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editId ? '••••••••' : 'Password details'}
                disabled={actionLoading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Client Alpha"
                disabled={actionLoading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {editId ? 'Update Customer' : 'Add Customer'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null)
                    setUsername('')
                    setPassword('')
                    setName('')
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
