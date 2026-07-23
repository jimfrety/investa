import React, { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { postChatMessage, executeTrade, addToWatchlist, recommendStock, fetchWatchlist } from '../api/client'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import ForumIcon from '@mui/icons-material/Forum'
import VerifiedIcon from '@mui/icons-material/Verified'
import LoopIcon from '@mui/icons-material/Loop'
import HandshakeIcon from '@mui/icons-material/Handshake'
import CheckIcon from '@mui/icons-material/Check'

// Helper function to extract potential stock tickers from response text
const extractTickers = (text, watchlist = [], messages = []) => {
  if (!text) return []
  
  // 1. Find all fully qualified tickers first, e.g. ASX:SSG or NZX:MEL
  // Also match cases like NASDAQ: AAPL (with space)
  const qualifiedRegex = /\b([A-Z]{2,6}):\s?([A-Z]{1,5})\b/g
  const qualifiedMatches = []
  let qMatch
  while ((qMatch = qualifiedRegex.exec(text)) !== null) {
    // Reconstruct without space
    qualifiedMatches.push(`${qMatch[1]}:${qMatch[2]}`)
  }
  
  // 2. Find standard unqualified tickers, e.g. SSG or MEL
  // We look for 2 to 5 letter uppercase words.
  const regex = /\b[A-Z]{2,5}\b/g
  const matches = text.match(regex) || []
  
  // Filter out common non-ticker uppercase words, helper words, currencies, acronyms
  const excludeWords = new Set([
    'I', 'A', 'AN', 'THE', 'AND', 'BUT', 'OR', 'IF', 'OF', 'FOR', 'TO', 'BY', 'ON', 'AT', 'IN', 'NO', 'YES',
    'AI', 'US', 'USA', 'USD', 'NZD', 'AUD', 'RSI', 'DCF', 'ETF',
    'HOLD', 'BUY', 'SELL', 'PAID', 'EX', 'FAQ', 'NZ', 'AU', 'UK', 'PE',
    'NAV', 'EPS', 'CAGR', 'MACD', 'SMA', 'YTD', 'IPO', 'CEO', 'CFO', 'CTO',
    'ASX', 'NZX', 'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX', 'SGX', 'HKEX', 'TSE',
    'IT', 'IS', 'AS', 'BE', 'DO', 'WE', 'HE', 'SO', 'UP', 'OUT', 'ARE', 'WAS', 'NOT',
    'ALL', 'ANY', 'CAN', 'HAS', 'HOW', 'NOW', 'WHY', 'WHO', 'YOU', 'OUR', 'THIS', 'THAT',
    'GOOD', 'BAD', 'HIGH', 'LOW', 'NEW', 'OLD', 'BIG', 'SMALL', 'TRUE', 'FALSE', 'NONE'
  ])
  
  const cleanMatches = matches.filter(word => !excludeWords.has(word))
  
  const result = [...qualifiedMatches]
  cleanMatches.forEach(symbol => {
    // If we already have a qualified version of this symbol, skip it
    if (qualifiedMatches.some(q => q.endsWith(':' + symbol))) return
    
    // Attempt to qualify it!
    // 1. Search conversation history for this symbol with a market prefix
    let foundMarket = null
    const historyRegex = new RegExp('\\b([A-Z]{2,6}):\\s?' + symbol + '\\b', 'i')
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      const histMatch = messages[idx].text.match(historyRegex)
      if (histMatch) {
        foundMarket = histMatch[1].toUpperCase()
        break
      }
    }
    
    // 2. Fall back to watchlist
    if (!foundMarket) {
      const watchlistMatch = watchlist.find(item => {
        const itemCode = item.code.toUpperCase()
        const cleanItemCode = itemCode.includes(':') ? itemCode.substring(itemCode.indexOf(':') + 1) : itemCode
        return cleanItemCode === symbol
      })
      if (watchlistMatch) {
        foundMarket = (watchlistMatch.market || '').toUpperCase()
      }
    }
    
    if (foundMarket) {
      result.push(foundMarket + ':' + symbol)
    } else {
      // Don't arbitrarily guess NZX. Just return the bare symbol so the user/backend can handle it.
      result.push(symbol)
    }
  })
  
  return Array.from(new Set(result))
}

export default function AIChatAssistant({ isOpen, onClose, preloadMessage, clearPreload, onRefetch }) {
  const queryClient = useQueryClient()
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: `### Welcome to Investa AI Assistant!
I analyze your active holdings, dividend yields, risk limits, and watchlist scores to provide context-grounded wealth advice.

Try asking:
* "I have $4,000 to invest."
* "Should I sell CrowdStrike now?"
* "Which holding has become the highest risk?"
* "Find three better dividend investments than AGNC."
`,
      confidence: 100,
      confidenceReason: 'Ready to manage your wealth'
    }
  ])
  
  const [executingTrades, setExecutingTrades] = useState(false)
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState('')

  // Inline recommendation form states
  const [activeRecommendTicker, setActiveRecommendTicker] = useState(null) // { messageIndex, ticker }
  const [activeRecommendNotes, setActiveRecommendNotes] = useState('')
  const [recommendStatus, setRecommendStatus] = useState({}) // ticker -> string status

  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch watchlist to check existing items
  const { data: watchlist = [], refetch: refetchWatchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist
  })

  // Handle preloaded prompts from the overview page
  useEffect(() => {
    if (preloadMessage && isOpen) {
      handleSendMessage(preloadMessage)
      clearPreload()
    }
  }, [preloadMessage, isOpen])

  const chatMutation = useMutation({
    mutationFn: postChatMessage,
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer,
          confidence: data.confidence,
          confidenceReason: data.confidenceReason,
          action: data.action,
          rebalanceDetails: data.rebalanceDetails
        }
      ])
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Sorry, I encountered an error researching this request. Please verify your connection.',
          confidence: 0
        }
      ])
    }
  })

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputMessage
    if (!text.trim()) return

    setMessages((prev) => [...prev, { sender: 'user', text }])
    setInputMessage('')
    
    // Call API
    chatMutation.mutate(text)
  }

  // Watchlist & Recommendation actions
  const handleAddToWatchlist = async (ticker) => {
    try {
      await addToWatchlist(ticker)
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      refetchWatchlist()
      if (onRefetch) onRefetch()
    } catch (err) {
      console.error('Failed to add to watchlist', err)
    }
  }

  const handleRecommendClick = (messageIndex, ticker) => {
    setActiveRecommendTicker({ messageIndex, ticker })
    setActiveRecommendNotes('')
  }

  const handleRecommendSubmit = async (ticker) => {
    if (!activeRecommendNotes.trim()) return
    try {
      await recommendStock({ code: ticker, notes: activeRecommendNotes })
      setRecommendStatus(prev => ({ ...prev, [ticker]: 'Recommended!' }))
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      setActiveRecommendTicker(null)
      setActiveRecommendNotes('')
    } catch (err) {
      setRecommendStatus(prev => ({ ...prev, [ticker]: 'Error: ' + err.message }))
    }
  }

  // Sizing execution loop
  const handleDeployRebalance = async (details) => {
    if (!details || details.length === 0) return
    setExecutingTrades(true)
    setTradeSuccessMsg('')
    
    try {
      for (const d of details) {
        await executeTrade({
          code: d.code,
          type: 'BUY',
          quantity: d.amount || (d.shares * d.price),
          price: d.price,
          brokerage: 15.00 // discounted brokerage for rebalance bundles
        })
      }
      setTradeSuccessMsg('Trades executed! Portfolio updated.')
      onRefetch()
    } catch (error) {
      setTradeSuccessMsg('Error executing bundle: ' + error.message)
    } finally {
      setExecutingTrades(false)
    }
  }

  // Simple parser to convert markdown titles and bold tags to html in React
  const parseMarkdown = (text) => {
    if (!text) return ''
    
    return text.split('\n').map((line, idx) => {
      let content = line
      
      // Headers
      if (content.startsWith('### ')) {
        return <h4 key={idx} style={{ color: 'var(--text-primary)', marginTop: '14px', marginBottom: '8px', fontSize: '15px' }}>{content.replace('### ', '')}</h4>
      }
      if (content.startsWith('## ')) {
        return <h3 key={idx} style={{ color: 'var(--text-primary)', marginTop: '16px', marginBottom: '10px', fontSize: '16px' }}>{content.replace('## ', '')}</h3>
      }
      
      // Bullet points
      if (content.startsWith('* ') || content.startsWith('- ')) {
        content = content.substring(2)
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginLeft: '12px', marginY: '4px' }}>
            <span style={{ color: 'var(--accent-indigo)' }}>•</span>
            <span>{renderBold(content)}</span>
          </div>
        )
      }

      return <p key={idx} style={{ marginBottom: '8px' }}>{renderBold(content)}</p>
    })
  }

  const renderBold = (text) => {
    const parts = text.split('**')
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{part}</strong> : part)
  }

  const isAlreadyWatchlisted = (code) => {
    const cleanCode = code.toUpperCase().includes(':') ? code.substring(code.indexOf(':') + 1) : code.toUpperCase()
    return watchlist.some(item => {
      const itemCode = item.code.toUpperCase()
      const cleanItemCode = itemCode.includes(':') ? itemCode.substring(itemCode.indexOf(':') + 1) : itemCode
      return cleanItemCode === cleanCode
    })
  }

  if (!isOpen) return null

  return (
    <div 
      className="ai-chat-drawer"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100dvh',
        backgroundColor: 'rgba(11, 15, 25, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-glass)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      {/* Header panel */}
      <div 
        style={{ 
          padding: '20px', 
          borderBottom: '1px solid var(--border-glass)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ForumIcon style={{ color: 'var(--accent-indigo)' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Investa Wealth Assistant</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time research enabled</span>
          </div>
        </div>
        <CloseIcon style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={onClose} />
      </div>

      {/* Messages Thread list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        {messages.map((msg, i) => {
          const detectedTickers = msg.sender === 'assistant' ? extractTickers(msg.text, watchlist, messages.slice(0, i)) : []

          return (
            <div 
              key={i} 
              className={`chat-bubble ${msg.sender}`}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.08)',
                border: msg.sender === 'user' ? '1px solid var(--border-glass)' : '1px solid rgba(99, 102, 241, 0.15)'
              }}
            >
              {parseMarkdown(msg.text)}

              {/* Detected Tickers Quick Action Strip */}
              {detectedTickers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', letterSpacing: '0.05em' }}>
                    DETECTED STOCKS:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detectedTickers.map(ticker => {
                      const isWatchlisted = isAlreadyWatchlisted(ticker)
                      const isRecommendingThis = activeRecommendTicker && activeRecommendTicker.messageIndex === i && activeRecommendTicker.ticker === ticker
                      const status = recommendStatus[ticker]

                      return (
                        <div key={ticker} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', alignSelf: 'flex-start' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{ticker}</strong>
                            
                            {isWatchlisted ? (
                              <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '700' }}>
                                <CheckIcon style={{ fontSize: '13px' }} /> Watchlisted
                              </span>
                            ) : (
                              <button 
                                onClick={() => handleAddToWatchlist(ticker)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-indigo)', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: '700' }}
                              >
                                + Watchlist
                              </button>
                            )}
                            
                            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>

                            {status ? (
                              <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                                {status}
                              </span>
                            ) : (
                              <button 
                                onClick={() => handleRecommendClick(i, ticker)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: '700' }}
                              >
                                Recommend
                              </button>
                            )}
                          </div>

                          {/* Inline Recommendation Form */}
                          {isRecommendingThis && (
                            <div style={{ 
                              background: 'rgba(0, 0, 0, 0.2)', 
                              border: '1px solid rgba(99, 102, 241, 0.2)', 
                              borderRadius: '8px', 
                              padding: '10px', 
                              marginTop: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Why do you recommend <strong>{ticker}</strong>?
                              </div>
                              <input 
                                type="text" 
                                placeholder="e.g. Solid dividend coverage, trading near DCF support" 
                                value={activeRecommendNotes}
                                onChange={(e) => setActiveRecommendNotes(e.target.value)}
                                className="investa-input"
                                style={{ fontSize: '12px', padding: '8px 10px' }}
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button 
                                  style={{ background: 'transparent', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}
                                  onClick={() => setActiveRecommendTicker(null)}
                                >
                                  Cancel
                                </button>
                                <button 
                                  className="investa-button"
                                  style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px' }}
                                  onClick={() => handleRecommendSubmit(ticker)}
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Confidence Gauge if from Assistant */}
              {msg.sender === 'assistant' && msg.confidence > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '10px' }}>
                  <span className="confidence-badge">
                    <VerifiedIcon fontSize="inherit" /> CONFIDENCE: {msg.confidence}%
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{msg.confidenceReason}</span>
                </div>
              )}

              {/* Auto trade action triggers */}
              {msg.sender === 'assistant' && msg.action === 'REBALANCE' && msg.rebalanceDetails && (
                <div 
                  style={{ 
                    marginTop: '16px', 
                    padding: '16px', 
                    backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                    border: '1px solid rgba(16, 185, 129, 0.2)', 
                    borderRadius: '10px' 
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HandshakeIcon /> ACTIONS APPROVED BY POLICY ENGINE
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Would you like to execute the above {msg.rebalanceDetails.length} transactions now? Your available cash will be redeployed automatically.
                  </div>
                  
                  {tradeSuccessMsg ? (
                    <div style={{ color: 'var(--accent-emerald)', fontSize: '12px', fontWeight: '700' }}>{tradeSuccessMsg}</div>
                  ) : (
                    <button 
                      className="investa-button" 
                      style={{ 
                        width: '100%', 
                        fontSize: '12px', 
                        padding: '8px',
                        background: 'linear-gradient(135deg, var(--accent-emerald) 0%, #059669 100%)',
                        boxShadow: 'none'
                      }}
                      onClick={() => handleDeployRebalance(msg.rebalanceDetails)}
                      disabled={executingTrades}
                    >
                      {executingTrades ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <LoopIcon className="rotate-icon" fontSize="small" /> EXECUTING TRADES...
                        </span>
                      ) : 'EXECUTE ALL DEPLOYMENTS'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {chatMutation.isPending && (
          <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <LoopIcon className="rotate-icon" style={{ animation: 'spin 1.5s linear infinite' }} /> Performing fresh market research...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input panel */}
      <div style={{ 
        padding: '16px 20px calc(16px + env(safe-area-inset-bottom, 0px))', 
        borderTop: '1px solid var(--border-glass)', 
        display: 'flex', 
        gap: '10px',
        background: 'rgba(11, 15, 25, 0.98)',
        zIndex: 10
      }}>
        <input 
          type="text" 
          placeholder="Ask a question (e.g. 'Invest $4,000')" 
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="investa-input"
          style={{ flex: 1 }}
          disabled={chatMutation.isPending}
        />
        <button 
          className="investa-button" 
          style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => handleSendMessage()}
          disabled={chatMutation.isPending}
        >
          <SendIcon />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .rotate-icon {
          animation: spin 1.5s linear infinite;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
