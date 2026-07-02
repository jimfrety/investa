export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/portfolio/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
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
