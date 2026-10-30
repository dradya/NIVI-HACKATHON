import React, { useState } from 'react';
import type { InvestigationReport } from '../../types';
import { formatConfidence, formatTimestamp } from '../../utils/helpers';

type Tab = 'summary' | 'contradictions' | 'gaps' | 'questions';

export function InvestigationReportView({ report }: { report: InvestigationReport }) {
  const [tab, setTab] = useState<Tab>('summary');
  const pct = Math.round(report.confidence_score * 100);
  const confColor = pct >= 80 ? '#2d6a4f' : pct >= 55 ? '#b8860b' : '#c0392b';

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'summary',         label: 'Summary' },
    { id: 'contradictions',  label: 'Contradictions', count: report.contradictions.length },
    { id: 'gaps',            label: 'Evidence Gaps',  count: report.gaps.length },
    { id: 'questions',       label: 'Open Questions', count: report.questions.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', animation: 'fade-up .3s ease both' }}>

      {/* Header */}
      <div style={{ padding: '28px 40px 20px', background: '#fff', borderBottom: '1px solid var(--brown-100)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--brown-900)', marginBottom: 5 }}>Investigation Report</h2>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)' }}>
              {report.investigation_id} · Generated {formatTimestamp(report.generated_at)}
            </p>
          </div>

          {/* Confidence gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="26" fill="none" stroke="var(--brown-100)" strokeWidth="5" />
              <circle cx="34" cy="34" r="26" fill="none" stroke={confColor} strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 26 * report.confidence_score} ${2 * Math.PI * 26}`}
                strokeLinecap="round" transform="rotate(-90 34 34)"
                style={{ transition: 'stroke-dasharray 1s ease' }} />
              <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="700" fill={confColor} fontFamily="JetBrains Mono, monospace">{pct}%</text>
            </svg>
            <span style={{ fontSize: 10, color: 'var(--brown-400)', whiteSpace: 'nowrap' }}>Overall Confidence</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--brown-100)', padding: '0 40px', background: '#fff', flexShrink: 0, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? 'var(--brown-600)' : 'transparent'}`,
            color: tab === t.id ? 'var(--brown-800)' : 'var(--brown-400)',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
            transition: 'color var(--ease), border-color var(--ease)',
            marginBottom: -1,
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, fontWeight: 700, color: tab === t.id ? 'var(--brown-600)' : 'var(--brown-300)' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px' }}>
        <div style={{ maxWidth: 700 }}>

          {tab === 'summary' && (
            <>
              <div style={{ background: '#fff', border: '1px solid var(--brown-200)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--brown-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>AI Summary</p>
                <p style={{ fontSize: 14, color: 'var(--brown-600)', lineHeight: 1.75 }}>{report.summary}</p>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--brown-800)', marginBottom: 14 }}>Key Findings</h3>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {report.key_findings.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, padding: '13px 16px', background: '#fff', border: '1px solid var(--brown-200)', borderRadius: 'var(--radius-md)', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)', paddingTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13, color: 'var(--brown-600)', lineHeight: 1.6 }}>{f}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {tab === 'contradictions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {report.contradictions.length === 0 && <Empty label="No contradictions detected." />}
              {report.contradictions.map(c => {
                const sevColor = { critical: '#c0392b', moderate: '#b8860b', minor: '#2d6a4f' }[c.severity];
                return (
                  <div key={c.id} style={{ background: '#fff', border: `1px solid var(--brown-200)`, borderRadius: 'var(--radius-lg)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)' }}>{c.id}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, color: sevColor, background: `${sevColor}18`, border: `1px solid ${sevColor}33`, textTransform: 'capitalize' }}>{c.severity}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--brown-600)', lineHeight: 1.6, marginBottom: 10 }}>{c.description}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.evidence_ids.map(id => <EvRef key={id} id={id} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'gaps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {report.gaps.length === 0 && <Empty label="No evidence gaps identified." />}
              {report.gaps.map(g => (
                <div key={g.id} style={{ background: '#fff', border: '1px solid var(--brown-200)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)' }}>{g.id}</span>
                  <p style={{ fontSize: 13, color: 'var(--brown-600)', lineHeight: 1.6 }}>{g.description}</p>
                  {g.timerange && (
                    <p style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-400)' }}>
                      {formatTimestamp(g.timerange.start)} → {formatTimestamp(g.timerange.end)}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--brown-400)' }}>Suggested:</span>
                    {g.suggested_evidence_types.map(t => (
                      <span key={t} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--brown-50)', border: '1px solid var(--brown-200)', borderRadius: 4, color: 'var(--brown-500)', textTransform: 'capitalize' }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {report.questions.length === 0 && <Empty label="No open questions." />}
              {report.questions.map(q => {
                const prioColor = { high: '#c0392b', medium: '#b8860b', low: '#2d6a4f' }[q.priority];
                return (
                  <div key={q.id} style={{ background: '#fff', border: '1px solid var(--brown-200)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)' }}>{q.id}</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, fontWeight: 600, color: prioColor, textTransform: 'capitalize' }}>{q.priority} priority</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--brown-800)', lineHeight: 1.6 }}>{q.question}</p>
                    {q.related_evidence_ids.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {q.related_evidence_ids.map(id => <EvRef key={id} id={id} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function EvRef({ id }: { id: string }) {
  return <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-400)', fontFamily: 'var(--font-data)' }}>{id}</span>;
}

function Empty({ label }: { label: string }) {
  return <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--brown-300)', fontSize: 13 }}>{label}</p>;
}
