import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchHoldings, executeTrade, fetchResearch, fetchSummary, fetchWatchlist, fetchWallet, API_BASE } from '../api/client'
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

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary
  })

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist
  })

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: fetchWallet,
    retry: false
  })

  const selectableSymbols = React.useMemo(() => {
    const symbolsSet = new Set(masterSymbols)
    holdings.forEach(h => {
      if (h.code) symbolsSet.add(h.code)
    })
    watchlist.forEach(w => {
      if (w.code) symbolsSet.add(w.code)
    })
    return Array.from(symbolsSet).sort()
  }, [holdings, watchlist, masterSymbols])

  const getShareName = (symbolCode) => {
    const held = holdings.find(h => h.code === symbolCode)
    if (held) return held.shareName

    const watchItem = watchlist.find(w => w.code === symbolCode)
    if (watchItem) return watchItem.shareName

    const fallbackNames = {
      "CRWD": "CrowdStrike Inc",
      "USF": "US Foods Holding Corp",
      "APA": "Smart Asia Pacific ETF",
      "EUF": "Smart Europe ETF",
      "ADAM": "Adamas",
      "HESM": "Hess Midstream",
      "EMF": "Smart Emerging Markets ETF",
      "OZY": "Smart Australian Top 20 ETF",
      "HVN": "Harvey Norman",
      "TXN": "Texas Instruments",
      "JNJ": "Johnson & Johnson",
      "ENB": "Enbridge Inc",
      "FTQI": "First Trust Nasdaq Buywrite Income ETF",
      "T": "AT&T",
      "MU": "Micron Technology",
      "AGNC": "AGNC Investment",
      "GOOG": "Alphabet Inc (Google)",
      "JEPI": "JPMorgan Equity Premium Income ETF",
      "VZ": "Verizon Communications",
      "SCHF": "Schwab International Equity ETF",
      "IONQ": "IonQ Inc",
      "VHY": "Vanguard Australian Shares High Yield ETF",
      "NPF": "Smart NZ Property ETF",
      "VNLA": "Janus Henderson Short Duration Income ETF",
      "PKLB": "Pacific Edge Ltd",
      "BKT": "Blackrock Income Trust Inc",
      "RGTI": "Rigetti Computing",
      "GCI": "Gryphon Capital Income Trust",
      "MIN": "MFS Intermediate Income Trust",
      "GNE": "Genesis Energy Ltd",
      "FNZ": "Smart NZ Top 50 ETF",
      "KMB": "Kimberly-Clark Corp",
      "O": "Realty Income Corp",
      "HVST": "Betashares Australian Div Harvester Active ETF",
      "QBITS": "D-Wave Quantum Inc",
      "META": "Meta Platforms Inc",
      "PFLT": "Pennantpark Floating Rate Capital Ltd",
      "AIR": "Air New Zealand Ltd",
      "XRO": "Xero Ltd",
      "ARX": "Arcadium Lithium plc",
      "SPK": "Spark New Zealand Ltd",
      "S": "SentinelOne Inc"
    }
    return fallbackNames[symbolCode] || symbolCode
  }

  const formattedBalances = React.useMemo(() => {
    if (!wallet) return null;
    const balances = [];
    if (Array.isArray(wallet)) {
      wallet.forEach(item => {
        if (item && typeof item === 'object') {
          const curr = item.currency || item.curr || item.currency_code || item.code || 'NZD';
          const bal = item.available || item.available_balance || item.balance || item.amount || item.total || '0';
          balances.push({ currency: curr.toUpperCase(), amount: parseFloat(bal) });
        }
      });
    } else if (typeof wallet === 'object') {
      Object.keys(wallet).forEach(key => {
        const val = wallet[key];
        if (val && typeof val === 'object') {
          const curr = val.currency || val.curr || val.currency_code || val.code || key;
          const bal = val.available || val.available_balance || val.balance || val.amount || val.total || '0';
          balances.push({ currency: curr.toUpperCase(), amount: parseFloat(bal) });
        } else if (val !== null && val !== undefined) {
          balances.push({ currency: key.toUpperCase(), amount: parseFloat(val) });
        }
      });
    }
    return balances.length > 0 ? balances : null;
  }, [wallet]);

  const selectedCurrency = React.useMemo(() => {
    const held = holdings.find(h => h.code === tradeCode);
    if (held && held.currency) return held.currency.toUpperCase();
    
    const watchItem = watchlist.find(w => w.code === tradeCode);
    if (watchItem && watchItem.market) {
      return watchItem.market === "NZX" ? "NZD" : watchItem.market === "ASX" ? "AUD" : "USD";
    }
    
    const nzSymbols = ["FNZ", "NPF", "GNE", "AIR", "XRO", "SPK", "PKLB", "EUF"];
    const auSymbols = ["VHY", "HVST", "OZY", "GCI", "HVN", "ARX"];
    
    if (nzSymbols.includes(tradeCode)) return "NZD";
    if (auSymbols.includes(tradeCode)) return "AUD";
    return "USD";
  }, [tradeCode, holdings, watchlist]);

  const localValidationWarning = React.useMemo(() => {
    if (tradeType !== 'BUY') return '';
    const amountToBuy = Number(tradeQty) || 0;
    if (amountToBuy <= 0) return '';
    
    const totalCashNZD = summary?.cashBalance ?? 0;
    let rate = 1.0;
    if (selectedCurrency === 'USD') rate = 1.65;
    if (selectedCurrency === 'AUD') rate = 1.10;
    
    const costInNZD = amountToBuy * rate;
    if (costInNZD > totalCashNZD) {
      return `Insufficient funds. Est. cost of $${costInNZD.toFixed(2)} NZD exceeds your available balance of $${totalCashNZD.toFixed(2)} NZD.`;
    }
    return '';
  }, [tradeQty, selectedCurrency, tradeType, summary]);

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
    
    let codeToUse = defaultCode
    if (selectableSymbols.length > 0 && !selectableSymbols.includes(codeToUse)) {
      codeToUse = selectableSymbols[0]
    }
    setTradeCode(codeToUse)
    
    // Autofill current price if held or watchlisted
    const held = holdings.find(h => h.code === codeToUse)
    const watchItem = watchlist.find(w => w.code === codeToUse)
    if (held) {
      setTradePrice(held.currentPrice)
    } else if (watchItem && watchItem.currentPrice) {
      setTradePrice(watchItem.currentPrice)
    } else {
      setTradePrice(50.0)
    }
    
    setTradeQty(type === 'BUY' ? 100 : 10)
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

    const calculatedBrokerage = tradeType === 'BUY'
      ? (tradeQty * 0.005)
      : (tradeQty * tradePrice * 0.005)

    const actualQuantity = tradeType === 'BUY'
      ? Number(((tradeQty - calculatedBrokerage) / tradePrice).toFixed(6))
      : Number(tradeQty)

    tradeMutation.mutate({
      code: tradeCode,
      type: tradeType,
      quantity: actualQuantity,
      price: Number(tradePrice),
      brokerage: Number(calculatedBrokerage.toFixed(2))
    })
  }

  const handleSyncPrices = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/portfolio/sync-prices`, {
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
      const res = await fetch(`${API_BASE}/portfolio/import`, {
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
    const watchItem = watchlist.find(w => w.code === code)
    if (held) {
      setTradePrice(held.currentPrice)
    } else if (watchItem && watchItem.currentPrice) {
      setTradePrice(watchItem.currentPrice)
    } else {
      setTradePrice(50.0)
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
      headerName: 'Investment Value', 
      valueGetter: p => {
        if (p.data?.investmentValue !== undefined && p.data?.investmentValue !== null && p.data?.investmentValue !== 0) {
          return p.data.investmentValue;
        }
        return (p.data?.quantity || 0) * (p.data?.currentPrice || 0);
      },
      flex: 1.1, 
      type: 'numericColumn',
      valueFormatter: p => `$${p.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      headerName: 'Simple Return', 
      field: 'simpleReturn', 
      valueGetter: p => {
        if (p.data?.simpleReturn !== undefined && p.data?.simpleReturn !== null && p.data?.simpleReturn !== 0) {
          return p.data.simpleReturn;
        }
        const cost = p.data?.avgPurchasePrice || 0;
        const cur = p.data?.currentPrice || 0;
        if (cost > 0) {
          return ((cur - cost) / cost) * 100.0;
        }
        return 0.0;
      },
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
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            onClick={() => setResearchCode(p.data.code)}
          >
            Research
          </button>
          <button 
            style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--text-primary)', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
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
      <div className="portfolio-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700' }} className="gradient-text">Portfolio Assets</h3>
        <div className="portfolio-toolbar-actions" style={{ display: 'flex', gap: '10px' }}>
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

      {/* Desktop AG Grid */}
      <div className="portfolio-desktop-grid ag-theme-quartz-dark" style={{ height: '480px', width: '100%' }}>
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

      {/* Mobile Card List */}
      <div className="portfolio-mobile-cards">
        {holdings.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px', fontSize: '14px' }}>
            No holdings found. Import your portfolio or connect Sharesies.
          </div>
        )}
        {holdings.map((h) => {
          const simpleReturn = h.simpleReturn ?? (h.avgPurchasePrice > 0 ? ((h.currentPrice - h.avgPurchasePrice) / h.avgPurchasePrice) * 100 : 0)
          const investmentValue = h.investmentValue ?? (h.quantity * h.currentPrice)
          const isPositive = simpleReturn >= 0
          return (
            <div key={h.id} className="glass-panel" style={{ padding: '16px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{h.code}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{h.market}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: isPositive ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {isPositive ? '+' : ''}{simpleReturn.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{h.shareName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800' }}>${investmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.quantity?.toFixed(2)} shares @ ${h.currentPrice?.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => handleOpenTrade('BUY', h.code)}
                >Buy More</button>
                <button
                  style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', background: 'rgba(244,63,94,0.1)', color: 'var(--accent-rose)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => handleOpenTrade('SELL', h.code)}
                >Sell</button>
                <button
                  style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => onAskAI(`Should I sell ${h.code} now?`)}
                >Ask AI</button>
              </div>
            </div>
          )
        })}
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
          
          {/* Available balance block */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-glass)',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Available Balance:</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: formattedBalances ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                {formattedBalances ? '● Connected' : 'Manual Portfolio'}
              </span>
            </div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '2px' }}>
               {formattedBalances 
                 ? `${formattedBalances.map(b => `$${b.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${b.currency}`).join(' / ')}`
                 : `$${(summary?.cashBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} NZD`}
            </strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Ticker Symbol</label>
            <select
              value={tradeCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="investa-input"
            >
              {/* Current Holdings — top priority */}
              {holdings.length > 0 && (
                <optgroup label="── Current Holdings ──">
                  {holdings.map(h => (
                    <option key={`holding-${h.code}`} value={h.code}>
                      {h.code} – {h.shareName} ({h.quantity?.toFixed(2)} shares @ ${h.currentPrice?.toFixed(2)})
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Watchlist items not already in holdings */}
              {watchlist.filter(w => !holdings.some(h => h.code === w.code)).length > 0 && (
                <optgroup label="── Watchlist ──">
                  {watchlist
                    .filter(w => !holdings.some(h => h.code === w.code))
                    .map(w => (
                      <option key={`watch-${w.code}`} value={w.code}>
                        {w.code} – {w.shareName} (${w.currentPrice?.toFixed(2)})
                      </option>
                    ))}
                </optgroup>
              )}

              {/* All other master symbols */}
              {masterSymbols.filter(s => !holdings.some(h => h.code === s) && !watchlist.some(w => w.code === s)).length > 0 && (
                <optgroup label="── Other Stocks ──">
                  {masterSymbols
                    .filter(s => !holdings.some(h => h.code === s) && !watchlist.some(w => w.code === s))
                    .map(s => (
                      <option key={`master-${s}`} value={s}>{s} – {getShareName(s)}</option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              {tradeType === 'BUY' ? `Amount to Invest (${selectedCurrency})` : 'Quantity of Shares to Sell'}
            </label>
            <input 
              type="number"
              value={tradeQty}
              onChange={(e) => setTradeQty(Number(e.target.value))}
              min="0.01"
              step="0.01"
              className="investa-input"
              required
            />
          </div>

          {/* Pricing & Fees Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glass)',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '12px'
          }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Current Price:</span>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', marginTop: '2px' }}>
                ${tradePrice.toFixed(2)} {selectedCurrency}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Est. Fee (0.5%):</span>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', marginTop: '2px' }}>
                ${(tradeType === 'BUY' ? (tradeQty * 0.005) : (tradeQty * tradePrice * 0.005)).toFixed(2)} {selectedCurrency}
              </div>
            </div>
            <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-glass)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                {tradeType === 'BUY' ? 'Estimated Shares:' : 'Estimated Proceeds:'}
              </span>
              <strong style={{ color: 'var(--accent-cyan)', fontSize: '14px' }}>
                {tradeType === 'BUY' 
                  ? `~${tradePrice > 0 ? ((tradeQty - (tradeQty * 0.005)) / tradePrice).toFixed(4) : 0} shares`
                  : `$${((tradeQty * tradePrice) - (tradeQty * tradePrice * 0.005)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selectedCurrency}`}
              </strong>
            </div>
          </div>

          {localValidationWarning && (
            <div style={{ 
              color: 'var(--accent-amber)', 
              fontSize: '12px', 
              fontWeight: '600', 
              padding: '8px 12px', 
              background: 'rgba(245, 158, 11, 0.08)', 
              borderRadius: '8px', 
              border: '1px solid rgba(245, 158, 11, 0.15)' 
            }}>
              ⚠️ {localValidationWarning}
            </div>
          )}

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
