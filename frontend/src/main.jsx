import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const customerId = localStorage.getItem('customerId');
  if (customerId) {
    const headers = options.headers ? { ...options.headers } : {};
    if (!(headers instanceof Headers)) {
      headers['X-Customer-ID'] = customerId;
      options.headers = headers;
    } else {
      headers.set('X-Customer-ID', customerId);
      options.headers = headers;
    }
  }
  return originalFetch(url, options);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
