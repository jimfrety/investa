import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import { fetchHoldings, fetchWatchlist, fetchSummary, fetchWallet, executeTrade } from '../api/client'

// List of all 42 symbols from Forecast.xlsx
const masterSymbols = [
  "CRWD", "USF", "APA", "EUF", "ADAM", "HESM", "EMF", "OZY", "HVN", "TXN",
  "JNJ", "ENB", "FTQI", "T", "MU", "AGNC", "GOOG", "JEPI", "VZ", "SCHF",
  "IONQ", "VHY", "NPF", "VNLA", "PKLB", "BKT", "RGTI", "GCI", "MIN", "GNE",
  "FNZ", "KMB", "O", "HVST", "QBITS", "META", "PFLT", "AIR", "XRO", "ARX",
  "SPK", "S"
].sort()

export default function TradeModal({ isOpen, onClose, initialType = 'BUY', initialCode = 'JEPI', onTradeExecuted }) {
  const [tradeType, setTradeType] = useState(initialType)
  const [tradeCode, setTradeCode] = useState(initialCode)
  const [tradeQty, setTradeQty] = useState(10)
  const [tradePrice, setTradePrice] = useState(55.0)
  const [errorMessage, setErrorMessage] = useState('')

  const { data: holdings = [] } = useQuery({ queryKey: ['holdings'], queryFn: fetchHoldings })
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: fetchSummary })
  const { data: watchlist = [] } = useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist })
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet, retry: false })

  const selectableSymbols = useMemo(() => {
    const symbolsSet = new Set(masterSymbols)
    holdings.forEach(h => { if (h.code) symbolsSet.add(h.code) })
    watchlist.forEach(w => { if (w.code) symbolsSet.add(w.code) })
    return Array.from(symbolsSet).sort()
  }, [holdings, watchlist])

  const getShareName = (symbolCode) => {
    const held = holdings.find(h => h.code === symbolCode)
    if (held) return held.shareName
    const watchItem = watchlist.find(w => w.code === symbolCode)
    if (watchItem) return watchItem.shareName
    const fallbackNames = {
      "CRWD": "CrowdStrike Inc", "USF": "US Foods Holding Corp", "APA": "Smart Asia Pacific ETF",
      "EUF": "Smart Europe ETF", "ADAM": "Adamas", "HESM": "Hess Midstream", "EMF": "Smart Emerging Markets ETF",
      "OZY": "Smart Australian Top 20 ETF", "HVN": "Harvey Norman", "TXN": "Texas Instruments",
      "JNJ": "Johnson & Johnson", "ENB": "Enbridge Inc", "FTQI": "First Trust Nasdaq Buywrite Income ETF",
      "T": "AT&T", "MU": "Micron Technology", "AGNC": "AGNC Investment", "GOOG": "Alphabet Inc (Google)",
      "JEPI": "JPMorgan Equity Premium Income ETF", "VZ": "Verizon Communications", "SCHF": "Schwab International Equity ETF",
      "IONQ": "IonQ Inc", "VHY": "Vanguard Australian Shares High Yield ETF", "NPF": "Smart NZ Property ETF",
      "VNLA": "Janus Henderson Short Duration Income ETF", "PKLB": "Pacific Edge Ltd", "BKT": "Blackrock Income Trust Inc",
      "RGTI": "Rigetti Computing", "GCI": "Gryphon Capital Income Trust", "MIN": "MFS Intermediate Income Trust",
      "GNE": "Genesis Energy Ltd", "FNZ": "Smart NZ Top 50 ETF", "KMB": "Kimberly-Clark Corp", "O": "Realty Income Corp",
      "HVST": "Betashares Australian Div Harvester Active ETF", "QBITS": "D-Wave Quantum Inc", "META": "Meta Platforms Inc",
      "PFLT": "Pennantpark Floating Rate Capital Ltd", "AIR": "Air New Zealand Ltd", "XRO": "Xero Ltd",
      "ARX": "Arcadium Lithium plc", "SPK": "Spark New Zealand Ltd", "S": "SentinelOne Inc"
    }
    return fallbackNames[symbolCode] || symbolCode
  }

  const formattedBalances = useMemo(() => {
    if (!wallet) return null
    const balances = []
    if (Array.isArray(wallet)) {
      wallet.forEach(item => {
        if (item && typeof item === 'object') {
          const curr = item.currency || item.curr || item.currency_code || item.code || 'NZD'
          const bal = item.available || item.available_balance || item.balance || item.amount || item.total || '0'
          balances.push({ currency: curr.toUpperCase(), amount: parseFloat(bal) })
        }
      })
    } else if (typeof wallet === 'object') {
      Object.keys(wallet).forEach(key => {
        const val = wallet[key]
        if (val && typeof val === 'object') {
          const curr = val.currency || val.curr || val.currency_code || val.code || key
          const bal = val.available || val.available_balance || val.balance || val.amount || val.total || '0'
          balances.push({ currency: curr.toUpperCase(), amount: parseFloat(bal) })
        } else if (val !== null && val !== undefined) {
          balances.push({ currency: key.toUpperCase(), amount: parseFloat(val) })
        }
      })
    }
    return balances.length > 0 ? balances : null
  }, [wallet])

  const selectedCurrency = useMemo(() => {
    const held = holdings.find(h => h.code === tradeCode)
    if (held && held.currency) return held.currency.toUpperCase()
    const watchItem = watchlist.find(w => w.code === tradeCode)
    if (watchItem && watchItem.market) {
      return watchItem.market === "NZX" ? "NZD" : watchItem.market === "ASX" ? "AUD" : "USD"
    }
    const nzSymbols = ["FNZ", "NPF", "GNE", "AIR", "XRO", "SPK", "PKLB", "EUF"]
    const auSymbols = ["VHY", "HVST", "OZY", "GCI", "HVN", "ARX"]
    if (nzSymbols.includes(tradeCode)) return "NZD"
    if (auSymbols.includes(tradeCode)) return "AUD"
    return "USD"
  }, [tradeCode, holdings, watchlist])

  useEffect(() => {
    if (isOpen) {
      setTradeType(initialType)
      let codeToUse = initialCode
      if (selectableSymbols.length > 0 && !selectableSymbols.includes(codeToUse)) {
        codeToUse = selectableSymbols[0]
      }
      setTradeCode(codeToUse)
      
      const held = holdings.find(h => h.code === codeToUse)
      const watchItem = watchlist.find(w => w.code === codeToUse)
      if (held) {
        setTradePrice(held.currentPrice)
      } else if (watchItem && watchItem.currentPrice) {
        setTradePrice(watchItem.currentPrice)
      } else {
        setTradePrice(50.0)
      }
      
      setTradeQty(initialType === 'BUY' ? 100 : 10)
      setErrorMessage('')
    }
  }, [isOpen, initialType, initialCode, selectableSymbols, holdings, watchlist])

  const handleCodeChange = (newCode) => {
    setTradeCode(newCode)
    const held = holdings.find(h => h.code === newCode)
    const watchItem = watchlist.find(w => w.code === newCode)
    if (held) {
      setTradePrice(held.currentPrice)
    } else if (watchItem && watchItem.currentPrice) {
      setTradePrice(watchItem.currentPrice)
    } else {
      setTradePrice(50.0)
    }
  }

  const localValidationWarning = useMemo(() => {
    if (tradeType !== 'BUY') return ''
    const amountToBuy = Number(tradeQty) || 0
    if (amountToBuy <= 0) return ''
    
    const totalCashNZD = summary?.cashBalance ?? 0
    let rate = 1.0
    if (selectedCurrency === 'USD') rate = 1.65
    if (selectedCurrency === 'AUD') rate = 1.10
    
    const costInNZD = amountToBuy * rate
    if (costInNZD > totalCashNZD) {
      return `Insufficient funds. Est. cost of $${costInNZD.toFixed(2)} NZD exceeds your available balance of $${totalCashNZD.toFixed(2)} NZD.`
    }
    return ''
  }, [tradeQty, selectedCurrency, tradeType, summary])

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess: () => {
      onTradeExecuted()
      onClose()
      setErrorMessage('')
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Trade failed')
    }
  })

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

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
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
            {holdings.length > 0 && (
              <optgroup label="── Current Holdings ──">
                {holdings.map(h => (
                  <option key={`holding-${h.code}`} value={h.code}>
                    {h.code} – {h.shareName} ({h.quantity?.toFixed(2)} shares @ ${h.currentPrice?.toFixed(2)})
                  </option>
                ))}
              </optgroup>
            )}

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
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="investa-button" disabled={tradeMutation.isPending}>
            {tradeMutation.isPending ? 'Executing...' : `Execute ${tradeType}`}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
