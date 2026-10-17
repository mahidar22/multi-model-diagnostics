import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from '../api/client'
import type { Artifact, ResearchCase, ResearchReport, ResearchRun, TaskFeature } from '../types/contracts'
import { Icon } from './Icon'

type Props = {
  caseRecord: ResearchCase
  token: string
  run: ResearchRun | null
  ragEnabled: boolean
  modelVersion: string
  taskName: string
  taskFeatures: TaskFeature[]
  maxUploadBytes: number
  onBack: () => void
  onCaseUpdated: (record: ResearchCase) => void
  onRunUpdated: (run: ResearchRun | null) => void
  onDeleted: () => void
}

function shortDate(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function bytesLabel(value: number) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function stepClass(done: boolean, current: boolean) {
  if (done) return 'step-marker is-done'
  if (current) return 'step-marker is-current'
  return 'step-marker'
}

export default function CaseWorkspace({ caseRecord, token, run, ragEnabled, modelVersion, taskName, taskFeatures, maxUploadBytes, onBack, onCaseUpdated, onRunUpdated, onDeleted }: Props) {
  const [artifactId, setArtifactId] = useState<string | undefined>(caseRecord.artifacts.at(-1)?.id)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [report, setReport] = useState<ResearchReport | null>(run?.reports?.at(-1) || null)
  const [question, setQuestion] = useState('')

  useEffect(() => {
    setArtifactId(caseRecord.artifacts.at(-1)?.id)
  }, [caseRecord.id, caseRecord.artifacts.length])

  useEffect(() => {
    setReport(run?.reports?.at(-1) || null)
  }, [run?.id, run?.reports?.length])

  const artifact: Artifact | undefined = useMemo(
    () => caseRecord.artifacts.find((item) => item.id === artifactId) || caseRecord.artifacts.at(-1),
    [caseRecord.artifacts, artifactId],
  )
  const validArtifact = artifact?.validation_status === 'VALID'
  const completed = Boolean(run)
  const features: TaskFeature[] = taskFeatures.length ? taskFeatures : [
    { name: 'marker_a', label: 'Synthetic marker A', type: 'float', minimum: -5, maximum: 5, unit: 'arbitrary' },
    { name: 'marker_b', label: 'Synthetic marker B', type: 'float', minimum: -5, maximum: 5, unit: 'arbitrary' },
    { name: 'marker_c', label: 'Synthetic marker C', type: 'float', minimum: -5, maximum: 5, unit: 'arbitrary' },
  ]
  const sampleCsv = `${features.map((item) => item.name).join(',')}\n${features.map((item) => ((item.minimum + item.maximum) / 2).toString()).join(',')}\n`
  const sampleCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`
  const maxUploadMiB = (maxUploadBytes / (1024 * 1024)).toFixed(0)
  const positiveClass = run?.explanation?.positive_class || run?.prediction.scores.at(-1)?.label || 'positive class'
  const negativeClass = run?.prediction.scores.find((item) => item.label !== positiveClass)?.label || 'other class'

  async function refreshCase() {
    const updated = await apiRequest<ResearchCase>(`/cases/${caseRecord.id}`, { token })
    onCaseUpdated(updated)
    return updated
  }

  async function uploadFile(file?: File) {
    if (!file) return
    setError('')
    setNotice('')
    setBusy('upload')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await apiRequest<{ artifact: Artifact; message: string }>(`/cases/${caseRecord.id}/artifacts`, { token, body: form })
      setArtifactId(response.artifact.id)
      onRunUpdated(null)
      setReport(null)
      await refreshCase()
      setNotice('Upload stored privately. Validate the file before inference.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.')
    } finally {
      setBusy('')
    }
  }

  async function validateArtifact() {
    if (!artifact) return
    setError('')
    setNotice('')
    setBusy('validate')
    try {
      const result = await apiRequest<{ validation: { valid: boolean } }>(`/cases/${caseRecord.id}/validate`, {
        token,
        body: { artifact_id: artifact.id },
      })
      await refreshCase()
      setNotice(result.validation.valid ? 'Validation passed. This one-row synthetic demo file is ready.' : 'Validation rejected the file. Review the message below.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
    } finally {
      setBusy('')
    }
  }

  async function startRun() {
    if (!artifact) return
    setError('')
    setNotice('')
    setReport(null)
    setBusy('run')
    try {
      const response = await apiRequest<{ run_id: string; status: string; run: ResearchRun }>(`/cases/${caseRecord.id}/runs`, {
        token,
        body: {
          artifact_id: artifact.id,
          model_version: modelVersion,
          requested_outputs: ['prediction', 'explanation'],
        },
      })
      onRunUpdated(response.run)
      await refreshCase()
      setNotice('Run completed. Review the synthetic output and its limitations.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Inference failed.')
    } finally {
      setBusy('')
    }
  }

  async function downloadExport() {
    setError('')
    setBusy('export')
    try {
      const blob = await apiRequest<Blob>(`/cases/${caseRecord.id}/export`, { token, responseType: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `research-case-${caseRecord.id.slice(0, 8)}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice('Case export downloaded.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed.')
    } finally {
      setBusy('')
    }
  }

  async function deleteCurrentCase() {
    const confirmed = window.confirm(`Delete ${caseRecord.pseudonymous_reference}? The uploaded file and all derived run records will be removed from this local store.`)
    if (!confirmed) return
    setBusy('delete')
    setError('')
    try {
      await apiRequest<void>(`/cases/${caseRecord.id}`, { token, method: 'DELETE' })
      onDeleted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Deletion failed.')
      setBusy('')
    }
  }

  async function requestReport(event: FormEvent) {
    event.preventDefault()
    if (!run) return
    setError('')
    setBusy('report')
    try {
      const response = await apiRequest<ResearchReport>(`/runs/${run.id}/report`, {
        token,
        body: { question },
      })
      setReport(response)
      const refreshedRun = await apiRequest<ResearchRun>(`/runs/${run.id}`, { token })
      onRunUpdated(refreshedRun)
      // The free-text query is kept only in this component's memory and is not stored by the API.
      setQuestion('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Evidence request failed.')
    } finally {
      setBusy('')
    }
  }

  const topScore = run?.prediction.scores.reduce((best, item) => item.score > best.score ? item : best, run.prediction.scores[0])
  const contributions = run?.explanation?.feature_contributions || []
  const contributionScale = Math.max(0.01, ...contributions.map((item) => Math.abs(item.contribution_to_positive_class_logit)))

  return (
    <div className="workspace-page">
      <div className="workspace-topline">
        <button className="back-link" onClick={onBack}><span className="back-arrow">←</span> All cases</button>
        <div className="case-actions">
          <button className="button button-secondary button-small" onClick={downloadExport} disabled={Boolean(busy)}><Icon name="download" size={15}/>{busy === 'export' ? 'Preparing…' : 'Export'}</button>
          <button className="button button-danger-ghost button-small" onClick={deleteCurrentCase} disabled={Boolean(busy)}><Icon name="trash" size={15}/>{busy === 'delete' ? 'Deleting…' : 'Delete case'}</button>
        </div>
      </div>

      <div className="case-title-row">
        <div>
          <div className="eyebrow">RESEARCH CASE <span className="tiny-dot"/> {caseRecord.status}</div>
          <h1>{caseRecord.pseudonymous_reference}</h1>
          <p className="muted">Created {shortDate(caseRecord.created_at)} <span className="text-divider">·</span> {taskName}</p>
        </div>
        <div className="case-id-chip"><Icon name="lock" size={14}/><span>Owner-scoped</span><small>{caseRecord.id.slice(0, 8)}</small></div>
      </div>

      <div className="workflow-rail" aria-label="Research workflow">
        <div className="workflow-step"><span className={stepClass(true, false)}><Icon name="check" size={14}/></span><div><b>Case</b><small>Created</small></div></div>
        <div className="workflow-connector is-done"/>
        <div className="workflow-step"><span className={stepClass(Boolean(artifact), !artifact)}>{artifact ? <Icon name="check" size={14}/> : '2'}</span><div><b>Input</b><small>{artifact ? 'Uploaded' : 'Awaiting file'}</small></div></div>
        <div className={`workflow-connector ${validArtifact ? 'is-done' : ''}`}/>
        <div className="workflow-step"><span className={stepClass(validArtifact, Boolean(artifact) && !validArtifact)}>{validArtifact ? <Icon name="check" size={14}/> : '3'}</span><div><b>Validate</b><small>{validArtifact ? 'Passed' : 'Schema check'}</small></div></div>
        <div className={`workflow-connector ${completed ? 'is-done' : ''}`}/>
        <div className="workflow-step"><span className={stepClass(completed, validArtifact && !completed)}>{completed ? <Icon name="check" size={14}/> : '4'}</span><div><b>Review</b><small>{completed ? (run?.status === 'PARTIAL' ? 'Partial output' : 'Run complete') : 'Human review'}</small></div></div>
      </div>

      {(error || notice) && <div className={`inline-notice ${error ? 'notice-error' : 'notice-success'}`} role="status"><Icon name={error ? 'alert' : 'check'} size={16}/><span>{error || notice}</span><button className="icon-button" onClick={() => { setError(''); setNotice('') }} aria-label="Dismiss"><Icon name="close" size={14}/></button></div>}

      <div className="case-grid">
        <section className="panel input-panel">
          <div className="panel-heading">
            <div className="panel-heading-icon teal-icon"><Icon name="database" size={18}/></div>
            <div><h2>Structured input</h2><p>One synthetic record · CSV only</p></div>
            <span className="panel-step-label">STEP 02</span>
          </div>

          <div className="scope-note"><span className="scope-dot"/>Configured modality <b>Structured</b><span className="scope-separator">/</span>not multimodal in this demo</div>

          {artifact ? (
            <div className="artifact-card">
              <div className="artifact-file-icon"><Icon name="file" size={20}/></div>
              <div className="artifact-main"><b>{artifact.label}</b><span>{bytesLabel(artifact.size_bytes)} <i>·</i> uploaded {shortDate(artifact.created_at)}</span></div>
              <span className={`status-pill ${artifact.validation_status === 'VALID' ? 'status-green' : artifact.validation_status === 'REJECTED' ? 'status-red' : 'status-neutral'}`}><span className="status-dot"/>{artifact.validation_status}</span>
            </div>
          ) : (
            <div className="upload-zone">
              <div className="upload-illustration"><div className="upload-cloud"><Icon name="upload" size={21}/></div></div>
              <h3>Upload a structured CSV</h3>
              <p>Exactly {features.length} manifest fields and 1 data row. UTF-8 only; maximum {maxUploadMiB} MiB.</p>
              <label className={`button button-primary ${busy === 'upload' ? 'is-disabled' : ''}`}>
                <Icon name="upload" size={16}/>{busy === 'upload' ? 'Uploading…' : 'Choose CSV'}
                <input type="file" accept=".csv,text/csv" disabled={Boolean(busy)} onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
              </label>
            </div>
          )}

          <div className="field-contract">
            <div className="contract-header"><span>Expected fields</span><a href={sampleCsvHref} download="sample_case.csv">Download sample <Icon name="download" size={13}/></a></div>
            <div className="field-list">
              {features.map((feature) => <div className="field-row" key={feature.name}><code>{feature.name}</code><span>{feature.type}</span><small>{feature.minimum} to {feature.maximum}</small></div>)}
            </div>
            <div className="field-footnote"><Icon name="lock" size={13}/>No identifiers. Arbitrary synthetic values only.</div>
          </div>

          {artifact?.validation_result?.issues?.length ? <div className="validation-issues">{artifact.validation_result.issues.map((issue, index) => <p key={`${issue.code}-${index}`}><Icon name="alert" size={14}/>{issue.message}</p>)}</div> : null}

          {artifact && <div className="input-actions">
            <button className="button button-secondary" onClick={() => { const input = document.getElementById('replace-csv') as HTMLInputElement | null; input?.click() }} disabled={Boolean(busy)}><Icon name="refresh" size={15}/>Replace file</button>
            <input id="replace-csv" type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
            <button className="button button-secondary" onClick={() => void validateArtifact()} disabled={Boolean(busy) || !artifact || validArtifact}>{busy === 'validate' ? 'Checking…' : validArtifact ? <><Icon name="check" size={15}/>Validated</> : 'Validate file'}</button>
          </div>}

          <div className="privacy-callout"><Icon name="shield" size={16}/><p><b>Private by default.</b> Files stay in the local store and are never served as public static content.</p></div>
        </section>

        <section className={`panel result-panel ${run ? 'has-run' : ''}`}>
          <div className="panel-heading">
            <div className="panel-heading-icon violet-icon"><Icon name="chart" size={18}/></div>
            <div><h2>Prediction & review</h2><p>Human review required for all outputs</p></div>
            {run && <span className={`status-pill ${run.status === 'SUCCEEDED' ? 'status-green' : 'status-amber'}`}><span className="status-dot"/>{run.status}</span>}
          </div>

          {!run ? (
            <div className="empty-result">
              <div className="empty-result-art"><div className="empty-orbit orbit-one"/><div className="empty-orbit orbit-two"/><div className="empty-center"><Icon name="spark" size={25}/></div><span className="orbit-node node-one"/><span className="orbit-node node-two"/><span className="orbit-node node-three"/></div>
              <h3>Ready when you are</h3>
              <p>Validate an input file to enable the demonstration run. Results are synthetic and non-clinical.</p>
              <button className="button button-primary run-button" onClick={() => void startRun()} disabled={!validArtifact || Boolean(busy)}><Icon name="spark" size={16}/>{busy === 'run' ? 'Running…' : 'Run demo model'}<Icon name="arrow" size={15}/></button>
              {!validArtifact && <small className="button-hint">Upload and validate the CSV to continue.</small>}
            </div>
          ) : (
            <div className="prediction-content">
              <div className="prediction-kicker"><span className="run-check"><Icon name="check" size={13}/></span>{run.status === 'PARTIAL' ? 'PREDICTION AVAILABLE · PARTIAL RUN' : 'DEMO RUN COMPLETE'} <span className="tiny-dot"/> {run.processing_ms} ms</div>
              <div className="prediction-main"><div><span className="prediction-label">Synthetic class</span><h3>{run.prediction.label}</h3></div><div className="prediction-score"><span>Top illustrative score</span><b>{Math.round((topScore?.score || 0) * 100)}<small>%</small></b></div></div>
              <div className="score-block"><div className="score-heading"><span>Class scores</span><small>{run.prediction.score_type}</small></div>
                {run.prediction.scores.map((score) => <div className="score-row" key={score.label}><div className="score-row-top"><span>{score.label}</span><b>{(score.score * 100).toFixed(1)}%</b></div><div className="score-track"><div className={`score-fill ${score.label === run.prediction.label ? 'score-fill-active' : ''}`} style={{ width: `${Math.min(100, Math.max(1, score.score * 100))}%` }}/></div></div>)}
              </div>
              <div className="modality-row"><span className="modality-tag present"><i/>Structured <b>present</b></span>{run.unconfigured_modalities.map((modality) => <span className="modality-tag" key={modality}><i/>{modality} <b>not configured</b></span>)}</div>
              <div className="warning-box"><Icon name="alert" size={16}/><div><b>{run.status === 'PARTIAL' ? 'Partial run — prediction is available' : 'Run warnings'}</b>{run.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>

              {run.explanation && <div className="explanation-block"><div className="explanation-head"><div><h3><Icon name="spark" size={15}/>Contribution view</h3><p>Directional contributions to the {positiveClass} logit</p></div><span className="method-tag">{run.explanation.method}</span></div>
                <div className="contribution-list">{contributions.map((item) => {
                  const value = item.contribution_to_positive_class_logit
                  return <div className="contribution-row" key={item.feature}><div className="contribution-label"><span>{item.label}</span><small>toward {value >= 0 ? positiveClass : negativeClass}</small></div><div className="contribution-track"><div className={`contribution-fill ${value >= 0 ? 'contribution-positive' : 'contribution-negative'}`} style={{ width: `${Math.max(5, (Math.abs(value) / contributionScale) * 100)}%` }}/></div><b className={value >= 0 ? 'text-teal' : 'text-violet'}>{value > 0 ? '+' : ''}{value.toFixed(3)}</b></div>
                })}</div>
                <p className="explain-limit">{run.explanation.limitations}</p>
              </div>}
              <div className="run-metadata"><span>Model <b>{run.model_version}</b></span><span>Preprocessing <b>{run.preprocessing_version}</b></span><span>Run <b>{run.id.slice(0, 8)}</b></span></div>
              <div className="rerun-row"><button className="button button-secondary button-small" onClick={() => void startRun()} disabled={!validArtifact || Boolean(busy)}><Icon name="refresh" size={14}/>{busy === 'run' ? 'Running…' : 'Run again on current input'}</button><span>Current manifest · synchronous</span></div>
            </div>
          )}
        </section>
      </div>

      {run && <section className="panel evidence-panel">
        <div className="panel-heading evidence-heading"><div className="panel-heading-icon amber-icon"><Icon name="file" size={18}/></div><div><h2>Evidence context</h2><p>Optional approved-source excerpt retrieval</p></div><span className={`status-pill ${ragEnabled ? 'status-green' : 'status-neutral'}`}><span className="status-dot"/>{ragEnabled ? 'ENABLED' : 'OFF BY DEFAULT'}</span></div>
        {!ragEnabled ? <div className="rag-off"><div className="rag-lock"><Icon name="lock" size={18}/></div><div><b>Evidence retrieval is disabled</b><p>No source collection or language model is bundled. Enable only after reviewing source permissions and approval requirements.</p></div></div> : <>
          <form className="evidence-query" onSubmit={(event) => void requestReport(event)}><label htmlFor="evidence-question">Research question</label><div className="query-control"><input id="evidence-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about approved source material…" maxLength={500} required/><button className="button button-primary button-small" disabled={busy === 'report' || question.trim().length < 4}>{busy === 'report' ? 'Searching…' : 'Retrieve'}</button></div><small>Do not include patient data or identifiers. This returns retrieved excerpts only; no LLM is configured.</small></form>
          {report && <div className={`report-result ${report.status === 'ABSTAINED' ? 'report-abstained' : ''}`}><div className="report-status"><b>{report.status === 'SUCCEEDED' ? 'Retrieved research context' : report.status === 'ABSTAINED' ? 'Evidence insufficient' : 'Retrieval disabled'}</b><span>{report.citations.length} source{report.citations.length === 1 ? '' : 's'}</span></div><p>{report.text}</p>{report.citations.map((citation) => <div className="citation-row" key={citation.source_id}><span className="citation-id">[{citation.source_id}]</span><div><b>{citation.title}</b><small>{citation.identifier || citation.url || 'Approved local source'}{citation.date ? ` · ${citation.date}` : ''}</small></div></div>)}{report.warnings.map((warning) => <small className="report-warning" key={warning}>ⓘ {warning}</small>)}</div>}
        </>}
      </section>}

      <div className="case-footnote"><Icon name="lock" size={13}/>Research prototype · local file store · {caseRecord.artifacts.length} artifact{caseRecord.artifacts.length === 1 ? '' : 's'} · Updated {shortDate(caseRecord.updated_at)}</div>
    </div>
  )
}
