import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, ApiFailure } from './api/client'
import CaseWorkspace from './components/CaseWorkspace'
import { Icon } from './components/Icon'
import type { EvaluationResult, Health, ResearchCase, ResearchRun } from './types/contracts'

type Page = 'overview' | 'cases' | 'evaluation' | 'safety'

type SessionResponse = { actor_id: string; authenticated: boolean; notice: string }

function dateLabel(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatError(error: unknown) {
  if (error instanceof ApiFailure) return `${error.message}${error.requestId ? ` (request ${error.requestId.slice(0, 8)})` : ''}`
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function SignInScreen({ onLogin }: { onLogin: (token: string) => Promise<void> }) {
  const [tokenValue, setTokenValue] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(tokenValue.trim())
    } catch (caught) {
      setError(formatError(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-background-shape login-shape-one"/><div className="login-background-shape login-shape-two"/>
      <div className="login-card">
        <div className="brand-lockup login-brand"><div className="brand-symbol"><span/><span/><span/><span/></div><div><strong>RESEARCH<span>LAB</span></strong><small>DECISION SUPPORT PROTOTYPE</small></div></div>
        <div className="login-tag"><span className="status-dot"/>LOCAL RESEARCH ENVIRONMENT</div>
        <h1>Welcome to your<br/><em>research workspace.</em></h1>
        <p className="login-intro">Sign in with the local bearer token configured by your project administrator.</p>
        <form onSubmit={(event) => void submit(event)} className="login-form">
          <label htmlFor="access-token">Access token</label>
          <div className="token-input-wrap"><Icon name="lock" size={17}/><input id="access-token" type={showToken ? 'text' : 'password'} value={tokenValue} onChange={(event) => setTokenValue(event.target.value)} placeholder="Paste your local access token" required autoComplete="off" spellCheck={false}/><button type="button" className="show-token" onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</button></div>
          {error && <div className="login-error"><Icon name="alert" size={15}/>{error}</div>}
          <button type="submit" className="button button-primary login-submit" disabled={loading || !tokenValue.trim()}>{loading ? 'Authenticating…' : 'Enter workspace'}<Icon name="arrow" size={16}/></button>
        </form>
        <div className="demo-credential"><div className="demo-credential-icon"><Icon name="file" size={16}/></div><div><b>Local demo credential</b><p><code>local-research-demo-token</code></p></div><span>DEV ONLY</span></div>
        <div className="login-safety"><Icon name="shield" size={16}/><p><b>Research-only prototype.</b> Not for diagnosis or treatment. Use only synthetic, permitted, de-identified research inputs.</p></div>
        <div className="login-footer"><span>v0.1.0</span><span>Local storage · no external AI calls</span></div>
      </div>
    </div>
  )
}

function CreateCaseDialog({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (reference: string) => Promise<void>; busy: boolean }) {
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleaned = reference.trim()
    if (cleaned && !/^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/.test(cleaned)) {
      setError('Use 3–64 letters, numbers, dots, underscores, or hyphens.')
      return
    }
    setError('')
    try { await onCreate(cleaned) } catch (caught) { setError(formatError(caught)) }
  }
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-case-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={18}/></button>
        <div className="modal-icon"><Icon name="plus" size={21}/></div>
        <span className="eyebrow">NEW RESEARCH RECORD</span>
        <h2 id="create-case-title">Create a case</h2>
        <p>Use a pseudonymous reference. A random case identifier will be generated automatically.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="case-reference">Pseudonymous reference <span>optional</span></label>
          <input id="case-reference" value={reference} onChange={(event) => { setReference(event.target.value); setError('') }} placeholder="e.g. CASE-001" maxLength={64} autoFocus/>
          <div className="form-helper"><Icon name="shield" size={14}/>No patient name, MRN, email, or direct identifier.</div>
          {error && <div className="login-error"><Icon name="alert" size={15}/>{error}</div>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create case'}<Icon name="arrow" size={15}/></button></div>
        </form>
      </div>
    </div>
  )
}

function EmptyCases({ onCreate }: { onCreate: () => void }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon name="folder" size={22}/></div><h3>No cases yet</h3><p>Create a pseudonymous research case to begin the structured-data demo workflow.</p><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={16}/>Create first case</button></div>
}

function CasesTable({ cases, onOpen }: { cases: ResearchCase[]; onOpen: (record: ResearchCase) => void }) {
  if (!cases.length) return null
  return (
    <div className="table-shell"><table className="cases-table"><thead><tr><th>CASE REFERENCE</th><th>INPUT</th><th>RUNS</th><th>LAST UPDATED</th><th>STATUS</th><th/></tr></thead><tbody>
      {cases.map((item) => <tr key={item.id} onClick={() => onOpen(item)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item) }}>
        <td><div className="case-table-ref"><span className="case-table-icon"><Icon name="folder" size={16}/></span><div><b>{item.pseudonymous_reference}</b><small>{item.id.slice(0, 8)} · created {dateLabel(item.created_at)}</small></div></div></td>
        <td><span className={`table-status ${item.artifacts.length ? 'has-data' : ''}`}><i/>{item.artifacts.length ? `${item.artifacts.length} artifact${item.artifacts.length === 1 ? '' : 's'}` : 'No input'}</span></td>
        <td><span className="table-run-count">{item.run_ids.length.toString().padStart(2, '0')}</span></td>
        <td className="muted-cell">{dateLabel(item.updated_at)}</td>
        <td><span className="status-pill status-neutral"><span className="status-dot"/>{item.status}</span></td>
        <td><button className="row-open" aria-label={`Open ${item.pseudonymous_reference}`} onClick={(event) => { event.stopPropagation(); onOpen(item) }}><Icon name="chevron" size={17}/></button></td>
      </tr>)}
    </tbody></table></div>
  )
}

function Overview({ cases, health, onCreate, onOpen, onNavigate }: { cases: ResearchCase[]; health: Health | null; onCreate: () => void; onOpen: (record: ResearchCase) => void; onNavigate: (page: Page) => void }) {
  const artifactCount = cases.reduce((count, item) => count + item.artifacts.length, 0)
  const runCount = cases.reduce((count, item) => count + item.run_ids.length, 0)
  return (
    <div className="page-stack">
      <div className="page-heading-row"><div><span className="eyebrow">OVERVIEW</span><h1>Good research starts with clarity.</h1><p className="muted">A local, transparent workspace for exploring the end-to-end workflow.</p></div><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={16}/>New research case</button></div>
      <section className="hero-card">
        <div className="hero-copy"><div className="hero-kicker"><span className="hero-kicker-dot"/>YOUR RESEARCH ENVIRONMENT</div><h2>From structured input<br/>to <em>reviewable output.</em></h2><p>Every step is explicit: validate inputs, inspect scores, understand limitations, and keep a human in the loop.</p><div className="hero-actions"><button className="button button-light" onClick={onCreate}>Start a new case <Icon name="arrow" size={15}/></button><button className="hero-link" onClick={() => onNavigate('safety')}>Explore safeguards <Icon name="arrow" size={14}/></button></div></div>
        <div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-a"/><div className="hero-orbit orbit-b"/><div className="hero-orbit orbit-c"/><div className="hero-signal signal-1"/><div className="hero-signal signal-2"/><div className="hero-signal signal-3"/><div className="hero-node"><span/><span/><span/><span/></div><div className="hero-visual-caption"><span className="caption-pulse"/>structured · versioned · reviewable</div></div>
      </section>
      <div className="stat-grid">
        <article className="stat-card"><div className="stat-card-top"><span>Research cases</span><span className="stat-icon icon-blue"><Icon name="folder" size={16}/></span></div><b>{cases.length.toString().padStart(2, '0')}</b><small>Owner-scoped local records</small></article>
        <article className="stat-card"><div className="stat-card-top"><span>Artifacts</span><span className="stat-icon icon-teal"><Icon name="database" size={16}/></span></div><b>{artifactCount.toString().padStart(2, '0')}</b><small>Stored outside the public web root</small></article>
        <article className="stat-card"><div className="stat-card-top"><span>Demo runs</span><span className="stat-icon icon-violet"><Icon name="chart" size={16}/></span></div><b>{runCount.toString().padStart(2, '0')}</b><small>Synchronous · provenance recorded</small></article>
        <article className="stat-card model-stat"><div className="stat-card-top"><span>Configured task</span><span className="stat-icon icon-amber"><Icon name="spark" size={16}/></span></div><b className="model-value">{health?.task_id || 'synthetic-tabular-demo'}</b><small><span className="live-dot"/>Structured modality · v1</small></article>
      </div>
      <div className="overview-bottom-grid">
        <section className="panel recent-panel"><div className="section-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Recent cases</h2></div>{cases.length > 0 && <button className="text-button" onClick={() => onNavigate('cases')}>View all <Icon name="arrow" size={14}/></button>}</div>
          {cases.length ? <CasesTable cases={cases.slice(0, 5)} onOpen={onOpen}/> : <EmptyCases onCreate={onCreate}/>}
        </section>
        <aside className="panel scope-panel"><div className="scope-header"><span className="scope-icon"><Icon name="shield" size={18}/></span><div><span className="eyebrow">SCOPE AT A GLANCE</span><h2>Focused by design</h2></div></div><div className="scope-list"><div><span className="scope-check"><Icon name="check" size={13}/></span><p><b>One modality</b><small>Structured CSV only</small></p></div><div><span className="scope-check"><Icon name="check" size={13}/></span><p><b>Synthetic values</b><small>Arbitrary demo features</small></p></div><div><span className="scope-check scope-muted"><Icon name="close" size={13}/></span><p><b>No clinical claims</b><small>Not for diagnosis or treatment</small></p></div></div><button className="scope-footer" onClick={() => onNavigate('safety')}>Review safety boundary <Icon name="arrow" size={14}/></button></aside>
      </div>
      <div className="bottom-safety-note"><div className="safety-note-icon"><Icon name="alert" size={17}/></div><div><b>Research-only prototype</b><p>Model scores are uncalibrated and based on a synthetic rule. Qualified human review is required; no clinical use is supported.</p></div><button onClick={() => onNavigate('safety')}>Read full notice <Icon name="arrow" size={13}/></button></div>
    </div>
  )
}

function CasesPage({ cases, onCreate, onOpen }: { cases: ResearchCase[]; onCreate: () => void; onOpen: (record: ResearchCase) => void }) {
  return <div className="page-stack"><div className="page-heading-row"><div><span className="eyebrow">CASE MANAGEMENT</span><h1>Research cases</h1><p className="muted">Create a pseudonymous record, add one structured input, and review its run history.</p></div><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={16}/>New case</button></div><section className="panel cases-list-panel"><div className="section-heading"><div><h2>All cases <span className="count-badge">{cases.length}</span></h2><p>Only cases owned by the signed-in actor are shown.</p></div><div className="case-list-lock"><Icon name="lock" size={15}/>PRIVATE TO YOUR ACCOUNT</div></div>{cases.length ? <CasesTable cases={cases} onOpen={onOpen}/> : <EmptyCases onCreate={onCreate}/>}</section></div>
}

function EvaluationPage({ token }: { token: string }) {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    apiRequest<EvaluationResult>('/evaluation/demo', { token }).then((data) => { if (active) setResult(data) }).catch((caught) => { if (active) setError(formatError(caught)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])
  return <div className="page-stack"><div className="page-heading-row"><div><span className="eyebrow">MODEL EVALUATION</span><h1>Evaluation, made explicit.</h1><p className="muted">Offline metrics for the bundled synthetic fixture—not clinical validation.</p></div><span className="fixture-pill"><span className="status-dot"/>SYNTHETIC FIXTURE</span></div>
    <div className="evaluation-warning"><div className="warning-emblem"><Icon name="alert" size={18}/></div><div><b>These metrics do not estimate medical performance.</b><p>The included 12-row dataset is fabricated to exercise the evaluation code path. It is not a patient cohort, external validation, or a model-quality claim.</p></div></div>
    {loading ? <div className="panel loading-panel">Loading evaluation fixture…</div> : error ? <div className="inline-notice notice-error"><Icon name="alert" size={16}/>{error}</div> : result && <>
      <div className="eval-summary-grid"><div className="eval-metric-card primary-metric"><span>Macro-F1</span><b>{(result.macro_f1 * 100).toFixed(1)}<small>%</small></b><p>Unweighted average across declared classes</p></div><div className="eval-metric-card"><span>Evaluation records</span><b>{result.sample_count}</b><p>Fixed synthetic fixture</p></div><div className="eval-metric-card"><span>Class labels</span><b>{result.labels.length}</b><p>Declared order is preserved</p></div></div>
      <div className="evaluation-grid"><section className="panel confusion-panel"><div className="section-heading"><div><span className="eyebrow">ERROR ANALYSIS</span><h2>Confusion matrix</h2></div><span className="matrix-legend">Rows: actual <span/> Columns: predicted</span></div><div className="matrix-wrap"><table className="matrix-table"><thead><tr><th>ACTUAL ↓<br/><span>PREDICTED →</span></th>{result.labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.labels.map((label, rowIndex) => <tr key={label}><th>{label}</th>{result.confusion_matrix[rowIndex].map((value, colIndex) => <td key={`${rowIndex}-${colIndex}`} className={rowIndex === colIndex ? 'matrix-correct' : 'matrix-error'}>{value}</td>)}</tr>)}</tbody></table></div><p className="matrix-caption">The diagonal shows matching labels in this synthetic fixture.</p></section>
        <section className="panel class-metrics-panel"><div className="section-heading"><div><span className="eyebrow">CLASS-WISE RESULTS</span><h2>Per-class metrics</h2></div></div><div className="class-metrics-table"><div className="class-metrics-row metrics-header"><span>Class</span><span>Precision</span><span>Recall</span><span>F1</span></div>{result.per_class.map((item) => <div className="class-metrics-row" key={item.label}><span><i className="class-dot"/>{item.label}</span><b>{(item.precision * 100).toFixed(0)}%</b><b>{(item.recall * 100).toFixed(0)}%</b><b>{(item.f1 * 100).toFixed(0)}%</b></div>)}</div><div className="metric-note"><Icon name="info" size={15}/>Metrics reflect only this fixed synthetic fixture.</div></section></div>
      <section className="panel eval-method"><div className="method-icon"><Icon name="file" size={18}/></div><div><b>Evaluation contract</b><p>Computed with the manifest's class order. The CLI accepts an already-separated CSV and reports confusion matrix, per-class precision/recall/F1 and macro-F1.</p><code>python scripts/evaluate.py</code></div></section>
    </>}
  </div>
}

function SafetyPage() {
  const safeguards = [
    { number: '01', title: 'Synthetic inputs only', text: 'The bundled task accepts arbitrary synthetic values. Do not upload real patient information to this demonstration.' },
    { number: '02', title: 'Human review is mandatory', text: 'Every output is a software demonstration. It is not a diagnosis, risk assessment, treatment choice, prescription, or triage recommendation.' },
    { number: '03', title: 'Clear modality boundaries', text: 'Only structured CSV is configured. Image, signal, and text inputs are not read, inferred, imputed, or implied to be present.' },
    { number: '04', title: 'Evidence is optional and constrained', text: 'RAG is disabled by default. No approved source collection or LLM is bundled. If enabled, only approved local excerpts are surfaced and weak evidence yields abstention.' },
    { number: '05', title: 'Local prototype controls', text: 'Token authentication, owner-scoped authorization, private files, checksum and validation checks are implemented. The default token is public and storage is not encrypted.' },
    { number: '06', title: 'Retention and deletion', text: 'The 30-day value is a manual policy target, not an automatic purge. Case deletion removes original and derived files; backup expiry must be managed separately.' },
  ]
  return <div className="page-stack"><div className="page-heading-row"><div><span className="eyebrow">RESPONSIBLE RESEARCH</span><h1>Safety is part of the system.</h1><p className="muted">A clear boundary between a workflow demo and clinical use.</p></div><span className="safety-status"><Icon name="shield" size={15}/>BOUNDARY ACTIVE</span></div><div className="safety-hero"><div className="safety-hero-icon"><Icon name="shield" size={23}/></div><div><span className="eyebrow">IMPORTANT NOTICE</span><h2>Research prototype only — not for clinical use.</h2><p>This application is not a medical device specification, proof of regulatory compliance, or substitute for qualified clinical judgment. No clinical dataset, validated model, or treatment knowledge base is included.</p></div></div><div className="safeguard-grid">{safeguards.map((item) => <article className="panel safeguard-card" key={item.number}><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div><div className="safety-bottom"><div><b>Before adapting this project for real research</b><p>Confirm the dataset, permitted use, data dictionary, label mapping, split strategy, security controls, retention policy, human review, institutional approvals and deployment requirements.</p></div><a href="/docs" target="_blank" rel="noreferrer">API docs <Icon name="external" size={14}/></a></div></div>
}

export default function App() {
  const [token, setToken] = useState('')
  const [actorId, setActorId] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [cases, setCases] = useState<ResearchCase[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [page, setPage] = useState<Page>('overview')
  const [selectedCase, setSelectedCase] = useState<ResearchCase | null>(null)
  const [selectedRun, setSelectedRun] = useState<ResearchRun | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem('research-lab-token')
    if (!saved) { setAuthChecking(false); return }
    let active = true
    apiRequest<SessionResponse>('/auth/session', { token: saved }).then((session) => {
      if (!active) return
      setToken(saved)
      setActorId(session.actor_id)
      setAuthenticated(true)
    }).catch(() => {
      sessionStorage.removeItem('research-lab-token')
      if (active) setAuthenticated(false)
    }).finally(() => { if (active) setAuthChecking(false) })
    return () => { active = false }
  }, [])

  const refreshCases = useCallback(async (activeToken: string) => {
    const response = await apiRequest<{ items: ResearchCase[]; count: number }>('/cases', { token: activeToken })
    setCases(response.items)
    return response.items
  }, [])

  useEffect(() => {
    if (!authenticated || !token) return
    let active = true
    setGlobalError('')
    Promise.all([
      apiRequest<{ items: ResearchCase[] }>('/cases', { token }),
      apiRequest<Health>('/health'),
    ]).then(([caseResponse, healthResponse]) => {
      if (!active) return
      setCases(caseResponse.items)
      setHealth(healthResponse)
    }).catch((caught) => {
      if (active) setGlobalError(formatError(caught))
    })
    return () => { active = false }
  }, [authenticated, token])

  async function handleLogin(inputToken: string) {
    const session = await apiRequest<SessionResponse>('/auth/session', { token: inputToken })
    sessionStorage.setItem('research-lab-token', inputToken)
    setToken(inputToken)
    setActorId(session.actor_id)
    setAuthenticated(true)
    setPage('overview')
  }

  function handleLogout() {
    sessionStorage.removeItem('research-lab-token')
    setAuthenticated(false)
    setToken('')
    setActorId('')
    setCases([])
    setSelectedCase(null)
    setSelectedRun(null)
  }

  async function createCase(reference: string) {
    setCreating(true)
    setGlobalError('')
    try {
      const record = await apiRequest<ResearchCase>('/cases', { token, body: { pseudonymous_reference: reference || undefined } })
      setCases((previous) => [record, ...previous])
      setSelectedCase(record)
      setSelectedRun(null)
      setShowCreate(false)
      setPage('cases')
    } catch (caught) {
      setGlobalError(formatError(caught))
      throw caught
    } finally {
      setCreating(false)
    }
  }

  async function openCase(record: ResearchCase) {
    setGlobalError('')
    setSelectedRun(null)
    setSelectedCase(record)
    setPage('cases')
    try {
      const fresh = await apiRequest<ResearchCase>(`/cases/${record.id}`, { token })
      setSelectedCase(fresh)
      if (fresh.run_ids.length) {
        const latest = await apiRequest<ResearchRun>(`/runs/${fresh.run_ids[fresh.run_ids.length - 1]}`, { token })
        const currentArtifactId = fresh.artifacts[fresh.artifacts.length - 1]?.id
        if (!currentArtifactId || latest.input_artifact_ids.includes(currentArtifactId)) setSelectedRun(latest)
      }
    } catch (caught) {
      setGlobalError(formatError(caught))
    }
  }

  function handleCaseUpdated(updated: ResearchCase) {
    setSelectedCase(updated)
    setCases((previous) => previous.map((item) => item.id === updated.id ? updated : item))
  }

  const navItems = useMemo(() => [
    { id: 'overview' as const, label: 'Overview', icon: 'grid' as const },
    { id: 'cases' as const, label: 'Research cases', icon: 'folder' as const },
    { id: 'evaluation' as const, label: 'Evaluation', icon: 'chart' as const },
    { id: 'safety' as const, label: 'Safety & scope', icon: 'shield' as const },
  ], [])

  if (authChecking) return <div className="app-loading"><div className="brand-symbol"><span/><span/><span/><span/></div><span>Opening local workspace…</span></div>
  if (!authenticated) return <SignInScreen onLogin={handleLogin}/>

  const title = selectedCase && page === 'cases' ? selectedCase.pseudonymous_reference : navItems.find((item) => item.id === page)?.label || 'Overview'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand"><div className="brand-symbol"><span/><span/><span/><span/></div><div><strong>RESEARCH<span>LAB</span></strong><small>DECISION SUPPORT</small></div></div>
        <div className="workspace-switch"><div className="workspace-avatar">R</div><div><small>WORKSPACE</small><b>Local research</b></div><span className="switch-dots">···</span></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); if (item.id !== 'cases') { setSelectedCase(null); setSelectedRun(null) } }}><Icon name={item.icon} size={18}/><span>{item.label}</span>{item.id === 'cases' && cases.length > 0 && <small className="nav-count">{cases.length}</small>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-storage"><div className="storage-top"><span><Icon name="lock" size={14}/>Private local storage</span><span className="storage-live"/></div><p>Data stays on this machine<br/>and is not shared externally.</p><div className="storage-bar"><span/></div><small>LOCAL PROTOTYPE</small></div><div className="sidebar-user"><div className="user-avatar">{actorId.slice(0, 1).toUpperCase() || 'R'}</div><div className="user-meta"><b>{actorId}</b><small>Researcher</small></div><button className="icon-button logout-button" onClick={handleLogout} title="Sign out" aria-label="Sign out"><Icon name="logout" size={17}/></button></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><div className="brand-symbol"><span/><span/><span/><span/></div><b>RESEARCH<span>LAB</span></b></div><div className="breadcrumbs"><span>Research Lab</span><Icon name="chevron" size={14}/><b>{title}</b></div><div className="topbar-right"><span className="environment-chip"><i/>LOCAL ENVIRONMENT</span><span className="model-version-chip">MODEL <b>{health?.model_version || 'demo-v1'}</b></span><button className="topbar-user" onClick={handleLogout} title="Sign out"><span className="topbar-avatar">{actorId.slice(0, 1).toUpperCase() || 'R'}</span><span>{actorId}</span><Icon name="logout" size={15}/></button></div></header>
        <div className="main-content">
          <div className="global-research-banner"><span className="banner-mark"><Icon name="alert" size={15}/></span><div><b>Research prototype only</b><span>Not for diagnosis, treatment, or clinical decision-making.</span></div><button onClick={() => setPage('safety')}>Safety scope <Icon name="arrow" size={13}/></button></div>
          {globalError && <div className="inline-notice notice-error global-error"><Icon name="alert" size={16}/><span>{globalError}</span><button className="icon-button" onClick={() => setGlobalError('')} aria-label="Dismiss"><Icon name="close" size={14}/></button></div>}
          {page === 'overview' && <Overview cases={cases} health={health} onCreate={() => setShowCreate(true)} onOpen={(record) => void openCase(record)} onNavigate={setPage}/>}
          {page === 'cases' && (selectedCase ? <CaseWorkspace caseRecord={selectedCase} token={token} run={selectedRun} ragEnabled={health?.rag_enabled || false} modelVersion={health?.model_version || 'synthetic-tabular-demo-v1'} taskName={health?.task_name || 'Synthetic cohort group classification'} taskFeatures={health?.features || []} maxUploadBytes={health?.max_upload_bytes || 5 * 1024 * 1024} onBack={() => { setSelectedCase(null); setSelectedRun(null) }} onCaseUpdated={handleCaseUpdated} onRunUpdated={(run) => setSelectedRun(run)} onDeleted={() => { setCases((previous) => previous.filter((item) => item.id !== selectedCase.id)); setSelectedCase(null); setSelectedRun(null); void refreshCases(token) }}/>
            : <CasesPage cases={cases} onCreate={() => setShowCreate(true)} onOpen={(record) => void openCase(record)}/>)}
          {page === 'evaluation' && <EvaluationPage token={token}/>}
          {page === 'safety' && <SafetyPage/>}
          <footer className="main-footer"><span>RESEARCH LAB <i>·</i> LOCAL PROTOTYPE v0.1.0</span><span><Icon name="lock" size={12}/>No external AI calls in this demo</span></footer>
        </div>
      </main>
      {showCreate && <CreateCaseDialog onClose={() => setShowCreate(false)} onCreate={createCase} busy={creating}/>}
    </div>
  )
}
