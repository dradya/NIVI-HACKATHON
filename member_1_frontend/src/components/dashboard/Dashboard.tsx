// ============================================================
// Dashboard — landing page + upload zone
// Fix 1: now receives onUpload (uploadFiles) from App so real
//         files trigger the real backend pipeline, not just demo.
// ============================================================

import React, { useCallback, useState } from 'react';
import type { AppState, ActiveView } from '../../types';
import { formatConfidence, confidenceLabel } from '../../utils/helpers';

interface Props {
  state: AppState;
  onNavigate: (v: ActiveView) => void;
  onUpload: (files: File[]) => void;   // real upload
  onDemo: () => void;                  // demo shortcut
}

export function Dashboard({ state, onNavigate, onUpload, onDemo }: Props) {
  const [drag, setDrag] = useState(false);
  const { session, evidenceCollection, investigation, timeline, isLoading, error } = state;
  const hasData      = !!evidenceCollection;
  const isProcessing = isLoading || session?.status === 'processing';

  // ── File input handler ────────────────────────────────────
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    onUpload(Array.from(files));
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div style={{ padding: '40px 48px', overflowY: 'auto', flex: 1, animation: 'fade-up .35s ease both' }}>

      {/* Title */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--brown-900)', letterSpacing: '-.02em', marginBottom: 8 }}>
          AI Reality Reconstructor
        </h1>
        <p style={{ color: 'var(--brown-500)', fontSize: 'var(--text-base)', maxWidth: '54ch', lineHeight: 1.65 }}>
          Upload multi-modal evidence — images, video, documents, sensor logs. The AI pipeline reconstructs what happened, when, and where.
        </p>
      </div>

      {/* Global error banner */}
      {error && (
        <div style={{
          background: '#fff1f0', border: '1px solid #ffa39e',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ color: '#c0392b', flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#c0392b', marginBottom: 2 }}>Upload or pipeline error</p>
            <p style={{ fontSize: 12, color: '#7f2020', lineHeight: 1.5 }}>{error}</p>
          </div>
        </div>
      )}

      {/* Processing progress */}
      {isProcessing && session && (
        <div style={{
          background: '#fff', border: '1px solid var(--brown-200)',
          borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 32,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-700)' }}>Processing Pipeline</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--brown-500)' }}>{session.progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--brown-100)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', background: 'var(--brown-500)', borderRadius: 2,
              width: `${session.progress}%`, transition: 'width .5s ease',
            }} />
          </div>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-400)' }}>{session.stage}</p>
        </div>
      )}

      {/* Upload zone */}
      {!hasData && !isProcessing && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${drag ? 'var(--brown-400)' : 'var(--brown-200)'}`,
            borderRadius: 'var(--radius-lg)', padding: '64px 40px',
            textAlign: 'center', marginBottom: 32, cursor: 'default',
            background: drag ? 'var(--brown-50)' : '#fff',
            transition: 'border-color var(--ease), background var(--ease)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 16, opacity: 0.5 }}>⬡</div>
          <p style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--brown-800)', marginBottom: 8 }}>
            Drop evidence files here
          </p>
          <p style={{ color: 'var(--brown-400)', fontSize: 13, marginBottom: 28 }}>
            Images, video, documents, sensor logs — any combination
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
            {/* Real file upload */}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 'var(--radius-md)',
              background: 'var(--brown-600)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'opacity var(--ease)',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.txt,.json,.log,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
              Select Files
            </label>

            {/* Demo shortcut */}
            <button onClick={onDemo} style={{
              padding: '10px 22px', borderRadius: 'var(--radius-md)',
              background: 'transparent', border: '1px solid var(--brown-200)',
              color: 'var(--brown-600)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
              transition: 'border-color var(--ease)',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brown-400)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brown-200)')}
            >
              Load Demo Case
            </button>
          </div>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)' }}>
            Supported: MP4 · MOV · JPG · PNG · PDF · TXT · JSON · CSV · LOG
          </p>
        </div>
      )}

      {/* Results */}
      {hasData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard label="Evidence Items"  value={evidenceCollection!.total_count}                         sub="files processed"       accent="var(--brown-600)" onClick={() => onNavigate('evidence')} />
            <StatCard label="Timeline Events" value={timeline?.events.length ?? 0}                            sub="reconstructed moments" accent="var(--brown-600)" onClick={() => onNavigate('timeline')} />
            <StatCard label="Confidence"      value={formatConfidence(investigation?.confidence_score ?? 0)}  sub="overall reconstruction" accent={confidenceLabel(investigation?.confidence_score ?? 0).color} onClick={() => onNavigate('investigation')} />
            <StatCard label="Contradictions"  value={investigation?.contradictions.length ?? 0}               sub="flagged conflicts"     accent={investigation && investigation.contradictions.length > 0 ? '#c0392b' : '#2d6a4f'} onClick={() => onNavigate('investigation')} />
          </div>

          {investigation && (
            <div style={{ background: '#fff', border: '1px solid var(--brown-200)', borderRadius: 'var(--radius-lg)', padding: 28, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--brown-800)' }}>Key Findings</h2>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {investigation.key_findings.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)', paddingTop: 3, width: 18, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--brown-600)', lineHeight: 1.6 }}>{f}</span>
                  </li>
                ))}
              </ol>
              <button onClick={() => onNavigate('investigation')} style={{
                marginTop: 20, padding: '8px 18px', borderRadius: 'var(--radius-md)',
                background: 'transparent', border: '1px solid var(--brown-200)',
                color: 'var(--brown-600)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'border-color var(--ease)',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brown-400)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brown-200)')}
              >
                Full Investigation Report →
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { icon: '◈', title: 'Evidence Library',  desc: `${evidenceCollection!.total_count} items — images, video, documents & sensors`, dest: 'evidence' as ActiveView },
              { icon: '⊳', title: 'Event Timeline',    desc: `${timeline?.events.length ?? 0} events over ${Math.round(((new Date(timeline?.end_time ?? 0).getTime() - new Date(timeline?.start_time ?? 0).getTime()) / 60000))} minutes`, dest: 'timeline' as ActiveView },
              { icon: '⊡', title: '3D Scene Model',    desc: 'Interactive 3D floor plan — click objects to cross-link with evidence and timeline', dest: 'scene' as ActiveView },
            ].map(c => (
              <button key={c.title} onClick={() => onNavigate(c.dest)} style={{
                background: '#fff', border: '1px solid var(--brown-200)',
                borderRadius: 'var(--radius-lg)', padding: 20, textAlign: 'left',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                fontFamily: 'var(--font-ui)', width: '100%',
                transition: 'border-color var(--ease), box-shadow var(--ease)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brown-300)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brown-200)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: '1.25rem', color: 'var(--brown-400)' }}>{c.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown-800)' }}>{c.title}</span>
                <span style={{ fontSize: 12, color: 'var(--brown-400)', lineHeight: 1.5 }}>{c.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent, onClick }: {
  label: string; value: string | number; sub: string; accent: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', border: '1px solid var(--brown-200)',
      borderRadius: 'var(--radius-lg)', padding: '20px 20px 18px',
      textAlign: 'left', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 4,
      fontFamily: 'var(--font-ui)', width: '100%',
      transition: 'box-shadow var(--ease), border-color var(--ease)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--brown-300)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--brown-200)'; }}
    >
      <span style={{ fontSize: '2rem', fontWeight: 700, color: accent, fontFamily: 'var(--font-data)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-800)', marginTop: 6 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--brown-400)' }}>{sub}</span>
    </button>
  );
}
