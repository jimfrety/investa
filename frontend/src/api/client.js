export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/portfolio/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchSnapshots() {
  const res = await fetch(`${API_BASE}/portfolio/snapshots`);
  if (!res.ok) throw new Error('Failed to fetch snapshots');
  return res.json();
}

export async function fetchHoldings() {
  const res = await fetch(`${API_BASE}/portfolio/holdings`);
  if (!res.ok) throw new Error('Failed to fetch holdings');
  return res.json();
}

export async function fetchTransactions() {
  const res = await fetch(`${API_BASE}/portfolio/transactions`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function fetchWatchlist() {
  const res = await fetch(`${API_BASE}/market/watchlist`);
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function fetchPolicy() {
  const res = await fetch(`${API_BASE}/policy`);
  if (!res.ok) throw new Error('Failed to fetch policy');
  return res.json();
}

export async function updatePolicy(policy) {
  const res = await fetch(`${API_BASE}/policy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy)
  });
  if (!res.ok) throw new Error('Failed to update policy');
  return res.json();
}

export async function executeTrade(trade) {
  const res = await fetch(`${API_BASE}/portfolio/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade)
  });
  if (!res.ok) throw new Error('Failed to execute trade');
  return res.json();
}

export async function fetchRiskMetrics() {
  const res = await fetch(`${API_BASE}/market/risk`);
  if (!res.ok) throw new Error('Failed to fetch risk metrics');
  return res.json();
}

export async function fetchDividendMetrics() {
  const res = await fetch(`${API_BASE}/market/dividends/metrics`);
  if (!res.ok) throw new Error('Failed to fetch dividend metrics');
  return res.json();
}

export async function fetchDividendCalendar() {
  const res = await fetch(`${API_BASE}/market/dividends/calendar`);
  if (!res.ok) throw new Error('Failed to fetch dividend calendar');
  return res.json();
}

export async function fetchDividendPayments() {
  const res = await fetch(`${API_BASE}/market/dividends/payments`);
  if (!res.ok) throw new Error('Failed to fetch dividend payments');
  return res.json();
}

export async function postChatMessage(message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error('Failed to post chat message');
  return res.json();
}

export async function fetchResearch(code) {
  const res = await fetch(`${API_BASE}/market/research/${code}`);
  if (!res.ok) throw new Error('Failed to fetch research data');
  return res.json();
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Login failed');
  }
  return res.json();
}

export async function fetchCustomers() {
  const res = await fetch(`${API_BASE}/admin/customers`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createCustomer(customer) {
  const res = await fetch(`${API_BASE}/admin/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to create customer');
  }
  return res.json();
}

export async function updateCustomer(id, customer) {
  const res = await fetch(`${API_BASE}/admin/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer)
  });
  if (!res.ok) throw new Error('Failed to update customer');
  return res.json();
}

export async function deleteCustomer(id) {
  const res = await fetch(`${API_BASE}/admin/customers/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete customer');
  return res.json();
}

export async function fetchSystemGeminiKey() {
  const res = await fetch(`${API_BASE}/admin/settings/gemini`);
  if (!res.ok) throw new Error('Failed to fetch system Gemini key');
  return res.json();
}

export async function updateSystemGeminiKey(key) {
  const res = await fetch(`${API_BASE}/admin/settings/gemini`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });
  if (!res.ok) throw new Error('Failed to update system Gemini key');
  return res.json();
}

export async function updateProfile(profile) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to update profile');
  }
  return res.json();
}
