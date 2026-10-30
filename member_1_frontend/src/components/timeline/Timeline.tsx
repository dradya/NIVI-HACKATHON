// ============================================================
// Timeline — emits onSelectEvent so the scene highlights the
// matching 3D object(s) when the user clicks a timeline event.
// Events that are highlighted externally (from scene selection)
// are shown with an amber left border.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import type { TimelineData, TimelineEvent, SceneSelection } from '../../types';
import { formatTimestamp, formatTime, formatConfidence, confidenceLabel } from '../../utils/helpers';

interface Props {
  data: TimelineData;
  selection: SceneSelection;
  onSelectEvent: (event: TimelineEvent | null) => void;
}

export function TimelineView({ data, selection, onSelectEvent }: Props) {
  const [filter, setFilter] = useState<'all' | 'primary' | 'secondary' | 'inferred'>('all');
  // Fix 6: derive selected event from shared selection state.
  // localSelected is now a derived value, not independent state —
  // so clicking a scene object that links to a timeline event will
  // automatically open the detail panel for that event.
  const localSelected = data.events.find(e => e.id === selection.highlightedEventId) ?? null;

  // Auto-scroll to the externally highlighted event
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selection.highlightedEventId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selection.highlightedEventId]);

  const events = data.events.filter(e => filter === 'all' || e.event_type === filter);
  const totalMin = Math.round((new Date(data.end_time).getTime() - new Date(data.start_time).getTime()) / 60000);

  const handleSelect = (ev: TimelineEvent) => {
    // Toggle: if already the highlighted event, clear; otherwise select
    const next = selection.highlightedEventId === ev.id ? null : ev;
    onSelectEvent(next);
  };

  // An event is "externally linked" if the scene/evidence panel is highlighting it
  const isLinked = (ev: TimelineEvent) =>
    ev.id === selection.highlightedEventId ||
    ev.evidence_ids.some(eid => selection.highlightedEvidenceIds.includes(eid));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', animation: 'fade-up .3s ease both' }}>

      {/* Header */}
      <div style={{ padding: '24px 36px 18px', background: '#fff', borderBottom: '1px solid var(--brown-100)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--brown-900)', marginBottom: 5 }}>Event Timeline</h2>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-400)' }}>
              {formatTimestamp(data.start_time)} → {formatTimestamp(data.end_time)} · {totalMin} min · {data.events.length} events
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'primary', 'secondary', 'inferred'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${filter === f ? 'var(--brown-600)' : 'var(--brown-200)'}`,
                background: filter === f ? 'var(--brown-600)' : '#fff',
                color: filter === f ? '#fff' : 'var(--brown-500)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'all 150ms',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px' }}>
          <div style={{ maxWidth: 620 }}>
            {events.map((ev, idx) => {
              const conf    = confidenceLabel(ev.confidence);
              const isSel   = localSelected?.id === ev.id;
              const linked  = isLinked(ev);
              const isLast  = idx === events.length - 1;

              return (
                <div
                  key={ev.id}
                  ref={linked ? highlightedRef : null}
                  style={{ display: 'grid', gridTemplateColumns: '52px 20px 1fr', gap: '0 14px', cursor: 'pointer' }}
                  onClick={() => handleSelect(ev)}
                >
                  {/* Time */}
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)', textAlign: 'right', paddingTop: 13, whiteSpace: 'nowrap' }}>
                    {formatTime(ev.timestamp)}
                  </div>

                  {/* Node + connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', marginTop: 11, flexShrink: 0,
                      border: `2px solid ${isSel ? 'var(--brown-600)' : linked ? '#b8860b' : 'var(--brown-300)'}`,
                      background: isSel ? 'var(--brown-600)' : linked ? '#b8860b22' : '#fff',
                      transition: 'all 200ms',
                    }}>
                      {(isSel || linked) && (
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSel ? '#fff' : '#b8860b', margin: '3.5px auto' }} />
                      )}
                    </div>
                    {!isLast && (
                      <div style={{ flex: 1, width: 1.5, background: linked ? '#b8860b44' : 'var(--brown-100)', minHeight: 12 }} />
                    )}
                  </div>

                  {/* Card */}
                  <div style={{
                    background: '#fff',
                    border: `1px solid ${isSel ? 'var(--brown-500)' : linked ? '#b8860b66' : 'var(--brown-200)'}`,
                    borderLeft: linked ? '3px solid #b8860b' : undefined,
                    borderRadius: 'var(--radius-lg)', padding: '12px 15px',
                    marginBottom: 12, marginTop: 5,
                    boxShadow: isSel ? 'var(--shadow-sm)' : 'none',
                    transition: 'border-color 200ms, box-shadow 200ms',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                          background: 'var(--brown-50)', color: 'var(--brown-500)', textTransform: 'capitalize',
                        }}>{ev.event_type}</span>
                        {linked && (
                          <span style={{ fontSize: 10, color: '#b8860b', fontFamily: 'var(--font-data)' }}>● linked</span>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: conf.color, fontWeight: 500 }}>
                        {formatConfidence(ev.confidence)}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--brown-600)', lineHeight: 1.6, marginBottom: 7 }}>{ev.description}</p>

                    {ev.entities.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                        {ev.entities.map(e => (
                          <span key={e} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-500)', fontFamily: 'var(--font-data)' }}>{e}</span>
                        ))}
                      </div>
                    )}

                    {ev.evidence_ids.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {ev.evidence_ids.map(id => (
                          <span key={id} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-300)', fontFamily: 'var(--font-data)' }}>{id}</span>
                        ))}
                      </div>
                    )}

                    {isSel && (
                      <p style={{ fontSize: 10, color: 'var(--brown-400)', marginTop: 8, fontStyle: 'italic' }}>
                        Click again to deselect · Linked objects highlighted in Scene Model
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel for selected event */}
        {localSelected && (
          <aside style={{ width: 280, minWidth: 280, background: '#fff', borderLeft: '1px solid var(--brown-100)', padding: 20, overflowY: 'auto', animation: 'slide-in .2s ease both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown-800)' }}>Event Detail</h3>
              <button onClick={() => onSelectEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-300)', fontSize: 14 }}>✕</button>
            </div>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)', marginBottom: 18 }}>{localSelected.id}</p>

            <DRow label="Timestamp"   value={formatTimestamp(localSelected.timestamp)} mono />
            <DRow label="Type"        value={localSelected.event_type} />
            <DRow label="Confidence"  value={`${formatConfidence(localSelected.confidence)} — ${confidenceLabel(localSelected.confidence).label}`} />
            <DRow label="Description" value={localSelected.description} />

            {localSelected.location && (
              <DRow label="Location" value={`x=${localSelected.location.x}m, y=${localSelected.location.y}m`} mono />
            )}

            {localSelected.entities.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <DLabel>Entities</DLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {localSelected.entities.map(e => (
                    <span key={e} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-500)', fontFamily: 'var(--font-data)' }}>{e}</span>
                  ))}
                </div>
              </div>
            )}

            {localSelected.evidence_ids.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <DLabel>Linked Evidence</DLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {localSelected.evidence_ids.map(id => (
                    <span key={id} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-300)', fontFamily: 'var(--font-data)' }}>{id}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--brown-50)', borderRadius: 7, border: '1px solid var(--brown-100)' }}>
              <p style={{ fontSize: 11, color: 'var(--brown-500)', lineHeight: 1.6 }}>
                Related scene objects are <strong>highlighted amber</strong> in the 3D Scene Model.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function DLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--brown-300)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{children}</label>;
}
function DRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <DLabel>{label}</DLabel>
      <span style={{ fontSize: 12, color: 'var(--brown-600)', lineHeight: 1.5, fontFamily: mono ? 'var(--font-data)' : 'var(--font-ui)' }}>{value}</span>
    </div>
  );
}
