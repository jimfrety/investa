import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchHoldings, executeTrade, fetchResearch } from '../api/client'
import { AgGridReact } from 'ag-grid-react'
import Dialog from '@mui/material/Dialog'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SyncIcon from '@mui/icons-material/Sync'

export default function PortfolioGrid({ onTradeExecuted, onAskAI }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTradeOpen, setIsTradeOpen] = useState(false)
  const [tradeType, setTradeType] = useState('BUY')
  const [tradeCode, setTradeCode] = useState('JEPI')
  const [tradeQty, setTradeQty] = useState(10)
  const [tradePrice, setTradePrice] = useState(55.0)
  const [tradeBrokerage, setTradeBrokerage] = useState(29.95)
  const [errorMessage, setErrorMessage] = useState('')
  const [validationWarning, setValidationWarning] = useState('')

  // Research modal state
  const [researchCode, setResearchCode] = useState(null)
  const { data: researchData } = useQuery({
    queryKey: ['research', researchCode],
    queryFn: () => fetchResearch(researchCode),
    enabled: !!researchCode
  })

  // List of all 42 symbols from Forecast.xlsx
  const masterSymbols = [
    "CRWD", "USF", "APA", "EUF", "ADAM", "HESM", "EMF", "OZY", "HVN", "TXN",
    "JNJ", "ENB", "FTQI", "T", "MU", "AGNC", "GOOG", "JEPI", "VZ", "SCHF",
    "IONQ", "VHY", "NPF", "VNLA", "PKLB", "BKT", "RGTI", "GCI", "MIN", "GNE",
    "FNZ", "KMB", "O", "HVST", "QBITS", "META", "PFLT", "AIR", "XRO", "ARX",
    "SPK", "S"
  ].sort()

  const { data: holdings = [], refetch } = useQuery({
    queryKey: ['holdings'],
    queryFn: fetchHoldings
  })

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess: () => {
      refetch()
      onTradeExecuted()
      setIsTradeOpen(false)
      setErrorMessage('')
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Trade failed')
    }
  })

  const handleOpenTrade = (type, defaultCode = 'JEPI') => {
    setTradeType(type)
    setTradeCode(defaultCode)
    
    // Autofill current price if held
    const held = holdings.find(h => h.code === defaultCode)
    if (held) {
      setTradePrice(held.currentPrice)
    } else {
      setTradePrice(50.0)
    }
    
    setTradeQty(10)
    setTradeBrokerage(29.95)
    setErrorMessage('')
    setValidationWarning('')
    setIsTradeOpen(true)
  }

  const handleTradeSubmit = (e) => {
    e.preventDefault()
    if (!tradeCode || tradeQty <= 0 || tradePrice <= 0) {
      setErrorMessage('Please fill in valid quantity and price.')
      return
    }
    tradeMutation.mutate({
      code: tradeCode,
      type: tradeType,
      quantity: Number(tradeQty),
      price: Number(tradePrice),
      brokerage: Number(tradeBrokerage)
    })
  }

  const handleSyncPrices = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/portfolio/sync-prices', {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Price sync request failed')
      alert('Latest prices are refreshing in the background from MarketStack!')
      setTimeout(() => {
        refetch()
        onTradeExecuted()
        setIsSyncing(false)
      }, 3500)
    } catch (err) {
      alert('Failed to sync prices: ' + err.message)
      setIsSyncing(false)
    }
  }

  const onCellValueChanged = async (event) => {
    const updatedRow = event.data
    try {
      const res = await fetch(`/api/portfolio/holdings/${updatedRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRow)
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to update holding')
      }
      onTradeExecuted()
    } catch (err) {
      alert('Error updating cell: ' + err.message)
      refetch()
    }
  }

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      setErrorMessage('Uploading spreadsheet...')
      const res = await fetch('/api/portfolio/import', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      if (res.ok && data.success) {
        setErrorMessage('')
        refetch()
        onTradeExecuted()
        alert('Spreadsheet imported successfully! Portfolio data refreshed.')
      } else {
        setErrorMessage(data.message || 'Failed to import spreadsheet')
      }
    } catch (err) {
      setErrorMessage('Network error uploading file')
    }
  }

  // Fetch price details when changing code
  const handleCodeChange = (code) => {
    setTradeCode(code)
    const held = holdings.find(h => h.code === code)
    if (held) {
      setTradePrice(held.currentPrice)
    }
    setValidationWarning('')
  }

  // AG Grid config
  const columnDefs = [
    { headerName: 'Share Name', field: 'shareName', flex: 1.5, minWidth: 150, editable: true },
    { headerName: 'Symbol', field: 'code', flex: 0.8, filter: true, editable: true },
    { headerName: 'Exchange', field: 'market', flex: 0.8, editable: true },
    { headerName: 'Sector', field: 'sector', flex: 1.2, editable: true },
    { 
      headerName: 'Risk', 
      field: 'risk', 
      flex: 0.6,
      editable: true,
      valueParser: p => {
        const num = parseInt(p.newValue, 10);
        return isNaN(num) ? p.oldValue : Math.min(7, Math.max(1, num));
      },
      cellRenderer: (p) => (
        <span style={{ 
          color: p.value >= 7 ? 'var(--accent-rose)' : p.value >= 5 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
          fontWeight: '700'
        }}>
          {p.value}/7
        </span>
      )
    },
    { 
      headerName: 'Shares', 
      field: 'quantity', 
      flex: 0.8, 
      type: 'numericColumn', 
      editable: true,
      valueParser: p => {
        const num = parseFloat(p.newValue);
        return isNaN(num) ? p.oldValue : num;
      },
      valueFormatter: p => p.value?.toFixed(2) 
    },
    { 
      headerName: 'Avg Cost', 
      field: 'avgPurchasePrice', 
      flex: 0.9, 
      type: 'numericColumn', 
      editable: true,
      valueParser: p => {
        const num = parseFloat(p.newValue);
        return isNaN(num) ? p.oldValue : num;
      },
      valueFormatter: p => `$${p.value?.toFixed(2)}` 
    },
    { 
      headerName: 'Current Price', 
      field: 'currentPrice', 
      flex: 0.9, 
      type: 'numericColumn', 
      editable: true,
      valueParser: p => {
        const num = parseFloat(p.newValue);
        return isNaN(num) ? p.oldValue : num;
      },
      valueFormatter: p => `$${p.value?.toFixed(2)}` 
    },
    { 
      headerName: 'Total Value', 
      valueGetter: p => p.data.quantity * p.data.currentPrice,
      flex: 1.0, 
      type: 'numericColumn',
      valueFormatter: p => `$${p.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      headerName: 'Unrealised P&L', 
      field: 'unrealisedGain', 
      flex: 1.1,
      type: 'numericColumn',
      cellRenderer: (p) => {
        const val = p.value ?? 0.0;
        const color = val >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
        const sign = val >= 0 ? '+' : '';
        return (
          <span style={{ color, fontWeight: '700' }}>
            {sign}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      }
    },
    { 
      headerName: 'Simple Return', 
      field: 'simpleReturn', 
      flex: 1.0,
      type: 'numericColumn',
      cellRenderer: (p) => {
        const val = p.value ?? 0.0;
        const color = val >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
        const sign = val >= 0 ? '+' : '';
        return (
          <span style={{ color, fontWeight: '700' }}>
            {sign}{val.toFixed(2)}%
          </span>
        )
      }
    },
    { 
      headerName: 'Last Updated', 
      field: 'lastUpdated', 
      flex: 1.2,
      valueFormatter: p => {
        if (!p.value) return 'Never'
        let date;
        if (Array.isArray(p.value)) {
          const [y, m, d, hr, min] = p.value;
          date = new Date(y, m - 1, d, hr, min);
        } else {
          date = new Date(p.value);
        }
        if (isNaN(date.getTime())) return 'Never';
        return date.toLocaleString(undefined, { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    },
    { 
      headerName: 'Actions', 
      cellRenderer: (p) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '100%' }}>
          <button 
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            onClick={() => setResearchCode(p.data.code)}
          >
            Research
          </button>
          <button 
            style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--text-primary)', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            onClick={() => onAskAI(`Should I sell ${p.data.code} now?`)}
          >
            Ask AI
          </button>
        </div>
      ),
      flex: 1.2,
      sortable: false,
      filter: false
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Table Actions Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700' }} className="gradient-text">Portfolio Assets</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="investa-button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleOpenTrade('BUY')}>
            <AddIcon fontSize="small" /> BUY STOCK
          </button>
          <button className="investa-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--bg-glass-hover) 0%, rgba(0,0,0,0.5) 100%)', border: '1px solid var(--border-glass)' }} onClick={() => handleOpenTrade('SELL')}>
            <RemoveIcon fontSize="small" /> SELL STOCK
          </button>
          <input 
            type="file" 
            id="excel-upload" 
            accept=".xlsx" 
            style={{ display: 'none' }} 
            onChange={handleExcelUpload} 
          />
          <button 
            className="investa-button" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(0,0,0,0.5) 100%)', border: '1px solid var(--border-glass)' }} 
            onClick={() => document.getElementById('excel-upload').click()}
          >
            📂 IMPORT EXCEL
          </button>
          <button 
            className="investa-button" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0.5) 100%)', border: '1px solid var(--border-glass)' }} 
            onClick={handleSyncPrices}
            disabled={isSyncing}
          >
            <SyncIcon fontSize="small" className={isSyncing ? 'spin-animation' : ''} />
            {isSyncing ? 'SYNCING...' : '🔄 SYNC PRICES'}
          </button>
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="ag-theme-quartz-dark" style={{ height: '480px', width: '100%' }}>
        <AgGridReact
          rowData={holdings}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true
          }}
          onCellValueChanged={onCellValueChanged}
        />
      </div>

      {/* Trade execution modal */}
      <Dialog 
        open={isTradeOpen} 
        onClose={() => setIsTradeOpen(false)}
        PaperProps={{
          style: {
            backgroundColor: 'var(--bg-secondary)',
            backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 40%)',
            color: 'var(--text-primary)',
            borderRadius: '16px',
            border: '1px solid var(--border-glass)',
            padding: '24px',
            minWidth: '400px'
          }
        }}
      >
        <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>
          {tradeType} Stock Transaction
        </h3>
        
        <form onSubmit={handleTradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ticker Symbol</label>
            <select 
              value={tradeCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="investa-input"
            >
              {masterSymbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Quantity</label>
              <input 
                type="number"
                value={tradeQty}
                onChange={(e) => setTradeQty(Number(e.target.value))}
                min="0.01"
                step="0.01"
                className="investa-input"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Price ($)</label>
              <input 
                type="number"
                value={tradePrice}
                onChange={(e) => setTradePrice(Number(e.target.value))}
                min="0.01"
                step="0.01"
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Brokerage fee ($)</label>
            <input 
              type="number"
              value={tradeBrokerage}
              onChange={(e) => setTradeBrokerage(Number(e.target.value))}
              min="0"
              step="0.01"
              className="investa-input"
            />
          </div>

          {errorMessage && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '12px', fontWeight: '600' }}>
              ● {errorMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="investa-button" 
              style={{ background: 'none', border: '1px solid var(--border-glass)', boxShadow: 'none' }}
              onClick={() => setIsTradeOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="investa-button">
              Execute {tradeType}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Stock Research modal */}
      <Dialog
        open={!!researchCode}
        onClose={() => setResearchCode(null)}
        PaperProps={{
          style: {
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderRadius: '16px',
            border: '1px solid var(--border-glass)',
            padding: '24px',
            minWidth: '550px'
          }
        }}
      >
        {researchData ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '22px' }}>{researchCode} Fundamental Intelligence</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cached analysis</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
              <div>
                <h4 style={{ color: 'var(--accent-indigo)', marginBottom: '8px' }}>Fundamentals</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Revenue:</span> <strong>{researchData.revenue}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>EPS:</span> <strong>${researchData.eps?.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Return on Equity:</span> <strong>{(researchData.roe * 100)?.toFixed(1)}%</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>ROIC:</span> <strong>{(researchData.roic * 100)?.toFixed(1)}%</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Forward P/E:</span> <strong>{researchData.forwardPe?.toFixed(1)}x</strong></div>
                </div>
              </div>
              
              <div>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>Valuation & Technicals</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Intrinsic Value (DCF):</span> <strong>${researchData.dcfValue?.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Analyst Target:</span> <strong>${researchData.analystTarget?.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Margin of Safety:</span> <strong>{Math.round(researchData.marginOfSafety * 100)}%</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>RSI (14-day):</span> <strong>{researchData.rsi?.toFixed(1)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>MACD Alert:</span> <strong>{researchData.macd}</strong></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
              <strong style={{ color: 'var(--accent-amber)' }}>Latest Market Sentiment:</strong> {researchData.sentimentSummary} — {researchData.newsHighlights}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button 
                className="investa-button" 
                onClick={() => {
                  const askMsg = `Find three better dividend investments than ${researchCode}.`
                  setResearchCode(null)
                  onAskAI(askMsg)
                }}
              >
                Find Replacements
              </button>
              <button 
                className="investa-button" 
                style={{ background: 'none', border: '1px solid var(--border-glass)', boxShadow: 'none' }}
                onClick={() => setResearchCode(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading stock details...</div>
        )}
      </Dialog>
    </div>
  )
}
