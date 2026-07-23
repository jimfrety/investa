import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWatchlist, fetchRecommendations, recommendStock, addToWatchlist, removeFromWatchlist, unrecommendStock, actionRecommendation } from '../api/client'
import AddIcon from '@mui/icons-material/Add'
import AssistantIcon from '@mui/icons-material/Assistant'
import ShareIcon from '@mui/icons-material/Share'
import CheckIcon from '@mui/icons-material/Check'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonIcon from '@mui/icons-material/Person'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CloseIcon from '@mui/icons-material/Close'

export default function WatchlistOpportunity({ onAskAI, onTradeExecuted, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) {
  const queryClient = useQueryClient()
  const [localActiveTab, setLocalActiveTab] = useState('watchlist')
  const activeTab = propActiveTab || localActiveTab
  const setActiveTab = propSetActiveTab || setLocalActiveTab
  
  // Modal states for recommending a stock
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false)
  const [recommendCode, setRecommendCode] = useState('')
  const [recommendName, setRecommendName] = useState('')
  const [recommendNotes, setRecommendNotes] = useState('')
  const [recommendError, setRecommendError] = useState('')
  const [recommendSuccess, setRecommendSuccess] = useState('')

  const handleIgnoreRecommendation = (code) => {
    actionRecMutation.mutate(code)
  }

  // Queries
  const { data: watchlist = [], refetch: refetchWatchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist
  })

  const { data: recommendations = [], refetch: refetchRecommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchRecommendations,
    enabled: activeTab === 'recommendations'
  })

  // Mutations
  const addWatchlistMutation = useMutation({
    mutationFn: addToWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      refetchWatchlist()
    }
  })

  const removeWatchlistMutation = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      refetchWatchlist()
    }
  })

  const recommendMutation = useMutation({
    mutationFn: recommendStock,
    onSuccess: () => {
      setRecommendSuccess('Recommendation submitted to community!')
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      refetchRecommendations()
      setTimeout(() => {
        setIsRecommendModalOpen(false)
        setRecommendNotes('')
        setRecommendSuccess('')
      }, 1500)
    },
    onError: (err) => {
      setRecommendError(err.message || 'Failed to submit recommendation')
    }
  })

  const handleOpenRecommendModal = (code, name) => {
    setRecommendCode(code)
    setRecommendName(name)
    setRecommendNotes('')
    setRecommendError('')
    setRecommendSuccess('')
    setIsRecommendModalOpen(true)
  }

  const handleSubmitRecommendation = (e) => {
    e.preventDefault()
    setRecommendError('')
    setRecommendSuccess('')
    recommendMutation.mutate({
      code: recommendCode,
      notes: recommendNotes
    })
  }

  const handleAddWatchlist = (code) => {
    addWatchlistMutation.mutate(code)
    actionRecMutation.mutate(code)
  }

  const handleRemoveWatchlist = (code) => {
    removeWatchlistMutation.mutate(code)
  }

  const unrecommendMutation = useMutation({
    mutationFn: unrecommendStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      refetchRecommendations()
    }
  })

  const actionRecMutation = useMutation({
    mutationFn: actionRecommendation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      refetchRecommendations()
    }
  })

  const handleUnrecommend = (code) => {
    unrecommendMutation.mutate(code)
  }

  const hasUserRecommended = (code) => {
    const currentCustomerId = localStorage.getItem('customerId')
    if (!currentCustomerId) return false
    return recommendations.some(rec => 
      rec.customerId.toString() === currentCustomerId.toString() &&
      rec.code.toUpperCase() === code.toUpperCase()
    );
  }

  const isAlreadyWatchlisted = (code) => {
    return watchlist.some(item => item.code.toUpperCase() === code.toUpperCase())
  }

  const visibleRecommendations = recommendations.filter(rec => {
    const inWatchlist = isAlreadyWatchlisted(rec.code)
    return !inWatchlist
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }} className="gradient-text">WATCHLIST & RECOMMENDATIONS</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Evaluate top stock options or share recommendations with the community</p>
        </div>

        {/* Tab Controls */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.03)', 
          border: '1px solid var(--border-glass)', 
          borderRadius: '10px', 
          padding: '4px' 
        }}>
          <button 
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeTab === 'watchlist' ? 'var(--accent-indigo)' : 'transparent',
              color: activeTab === 'watchlist' ? '#white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab('watchlist')}
          >
            My Watchlist ({watchlist.length})
          </button>
          <button 
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeTab === 'recommendations' ? 'var(--accent-indigo)' : 'transparent',
              color: activeTab === 'recommendations' ? '#white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab('recommendations')}
          >
            Community Recommendations
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'watchlist' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {watchlist.map((item) => (
            <div key={item.code} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '230px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.shareName}</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '700' }}>{item.code} · {item.market}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                        ${item.currentPrice != null ? item.currentPrice.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-indigo)' }}>{item.overallScore}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FIT SCORE</span>
                  </div>
                </div>

                {/* Score breakdown metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Gross Yield</div>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{item.dividendYield != null ? `${item.dividendYield.toFixed(2)}%` : '0.00%'}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Div Quality</div>
                    <strong style={{ color: 'var(--accent-emerald)' }}>{item.dividendQuality || 60}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Growth</div>
                    <strong>{item.growth || 50}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Value</div>
                    <strong>{item.valueScore || 60}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Risk</div>
                    <strong style={{ color: item.risk >= 7 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{item.risk}/7</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Port. Fit</div>
                    <strong style={{ color: 'var(--accent-indigo)' }}>{item.portfolioFit || 75}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                <button 
                  className="investa-button" 
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => onAskAI(`Generate a DCF valuation and policy fit analysis for watchlisted ticker ${item.code}`)}
                >
                  <AssistantIcon fontSize="inherit" /> AI Research
                </button>
                {hasUserRecommended(item.code) ? (
                  <button 
                    className="investa-button-secondary" 
                    style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px', border: '1px solid rgba(244, 63, 94, 0.3)', backgroundColor: 'rgba(244, 63, 94, 0.05)', color: 'var(--accent-rose)' }}
                    onClick={() => handleUnrecommend(item.code)}
                  >
                    <CloseIcon fontSize="inherit" /> Un-recommend
                  </button>
                ) : (
                  <button 
                    className="investa-button-secondary" 
                    style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: 'var(--accent-emerald)' }}
                    onClick={() => handleOpenRecommendModal(item.code, item.shareName)}
                  >
                    <ShareIcon fontSize="inherit" /> Recommend
                  </button>
                )}
                <button 
                  style={{ 
                    padding: '6px 8px', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(244, 63, 94, 0.2)', 
                    backgroundColor: 'rgba(244, 63, 94, 0.05)', 
                    color: 'var(--accent-rose)', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => handleRemoveWatchlist(item.code)}
                >
                  <DeleteIcon fontSize="small" />
                </button>
              </div>
            </div>
          ))}
          {watchlist.length === 0 && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ color: 'var(--text-muted)' }}>Your watchlist is empty. Ask the AI Assistant for recommendations and add them here!</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {visibleRecommendations.map((rec) => (
            <div key={rec.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{rec.shareName}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '700' }}>{rec.code}</span>
                  </div>
                </div>

                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  borderLeft: '3px solid var(--accent-indigo)', 
                  padding: '10px 14px', 
                  borderRadius: '0 8px 8px 0', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  marginBottom: '15px',
                  fontStyle: 'italic'
                }}>
                  "{rec.notes || 'Recommended as a high-quality investment choice.'}"
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <PersonIcon fontSize="inherit" /> By {rec.customerName || 'Anonymous'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AccessTimeIcon fontSize="inherit" /> {new Date(rec.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="investa-button" 
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => handleAddWatchlist(rec.code)}
                  >
                    <AddIcon fontSize="small" /> Add
                  </button>
                  <button 
                    className="investa-button-secondary" 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '4px', 
                      fontSize: '12px', 
                      padding: '8px 12px', 
                      border: '1px solid rgba(244, 63, 94, 0.2)', 
                      backgroundColor: 'rgba(244, 63, 94, 0.05)', 
                      color: 'var(--accent-rose)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleIgnoreRecommendation(rec.code)}
                  >
                    <CloseIcon fontSize="small" /> Ignore
                  </button>
                </div>
              </div>
            </div>
          ))}
          {visibleRecommendations.length === 0 && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ color: 'var(--text-muted)' }}>No community recommendations shared yet. Be the first to recommend a stock!</p>
            </div>
          )}
        </div>
      )}

      {/* Recommendation Form Modal Overlay */}
      {isRecommendModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div className="glass-panel" style={{
            padding: '25px',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '90%',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '6px' }} className="gradient-text">
              Share Community Recommendation
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Explain to other Investa users why you consider <strong>{recommendName} ({recommendCode})</strong> a solid investment.
            </p>

            <form onSubmit={handleSubmitRecommendation} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Recommendation Justification / Notes
                </label>
                <textarea
                  rows="4"
                  value={recommendNotes}
                  onChange={(e) => setRecommendNotes(e.target.value)}
                  placeholder="e.g. Consistent payout history, solid 3-month growth trend, trading below fair value..."
                  className="investa-input"
                  style={{ 
                    resize: 'none', 
                    fontFamily: 'inherit', 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    padding: '10px'
                  }}
                  required
                />
              </div>

              {recommendError && (
                <div style={{ fontSize: '12px', color: 'var(--accent-rose)', fontWeight: '600', textAlign: 'center' }}>
                  {recommendError}
                </div>
              )}

              {recommendSuccess && (
                <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: '600', textAlign: 'center' }}>
                  {recommendSuccess}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="investa-button-secondary"
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)' }}
                  onClick={() => setIsRecommendModalOpen(false)}
                  disabled={recommendMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="investa-button"
                  style={{ flex: 2, padding: '10px' }}
                  disabled={recommendMutation.isPending}
                >
                  {recommendMutation.isPending ? 'Sharing...' : 'Share Recommendation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
