// ============================================================
// ObjectInspector.tsx
// Right-side detail panel for the selected 3D object.
// Shows object properties + all linked evidence items +
// all timeline events that reference those evidence IDs.
// Fires navigation callbacks to jump to Evidence / Timeline views.
// ============================================================

import React from 'react';
import type { SceneObject, EvidenceItem, TimelineEvent } from '../../types';
import { formatConfidence, confidenceLabel, formatTimestamp, formatTime, evidenceTypeIcon } from '../../utils/helpers';

interface Props {
  object: SceneObject;
  evidenceItems: EvidenceItem[];     // all evidence in the investigation
  timelineEvents: TimelineEvent[];   // all timeline events
  onClose: () => void;
  onViewEvidence: (id: string) => void;   // navigate to Evidence tab & highlight
  onViewTimeline: (id: string) => void;   // navigate to Timeline tab & highlight
}

export function ObjectInspector({ object, evidenceItems, timelineEvents, onClose, onViewEvidence, onViewTimeline }: Props) {
  const conf = confidenceLabel(object.confidence);

  // Gather evidence items linked to this object
  const linkedEvidence = evidenceItems.filter(e => object.evidence_ids.includes(e.id));

  // Gather timeline events that reference any of those evidence IDs
  const linkedEvents = timelineEvents.filter(ev =>
    ev.evidence_ids.some(eid => object.evidence_ids.includes(eid))
  );

  return (
    <aside style={{
      width: 280, minWidth: 280,
      background: '#fff',
      borderLeft: '1px solid var(--brown-200)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slide-in .2s ease both',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--brown-100)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                background: 'var(--brown-100)', color: 'var(--brown-600)', textTransform: 'capitalize',
              }}>{object.object_type}</span>
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-900)', lineHeight: 1.4 }}>{object.label}</h3>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--brown-300)', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0,
          }} aria-label="Close inspector">✕</button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

        {/* Object ID */}
        <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)', marginBottom: 16 }}>{object.id}</p>

        {/* Properties */}
        <Section label="Properties">
          <PropRow label="Confidence">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 3, background: 'var(--brown-100)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: conf.color, width: formatConfidence(object.confidence), borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: conf.color }}>
                {formatConfidence(object.confidence)} — {conf.label}
              </span>
            </div>
          </PropRow>
          <PropRow label="Position">
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-600)' }}>
              x = {object.position.x}m,&nbsp; y = {object.position.y}m
            </span>
          </PropRow>
          {object.dimensions && (
            <PropRow label="Footprint">
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-600)' }}>
                {object.dimensions.width}m × {object.dimensions.height}m
              </span>
            </PropRow>
          )}
        </Section>

        {/* Linked Evidence */}
        <Section label={`Linked Evidence (${linkedEvidence.length})`}>
          {linkedEvidence.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--brown-300)' }}>No evidence linked.</p>
            : linkedEvidence.map(ev => (
              <button key={ev.id} onClick={() => onViewEvidence(ev.id)} style={{
                width: '100%', textAlign: 'left', padding: '9px 10px',
                background: 'var(--brown-50)', border: '1px solid var(--brown-100)',
                borderRadius: 7, marginBottom: 7, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', transition: 'border-color 150ms',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brown-300)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brown-100)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brown-600)', textTransform: 'capitalize' }}>
                    {evidenceTypeIcon(ev.type)} {ev.type}
                  </span>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: confidenceLabel(ev.confidence).color }}>
                    {formatConfidence(ev.confidence)}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--brown-500)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.description}
                </p>
                <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)', marginTop: 3 }}>
                  {ev.source_file}
                </p>
                <p style={{ fontSize: 10, color: 'var(--brown-400)', marginTop: 3 }}>
                  View in Evidence →
                </p>
              </button>
            ))
          }
        </Section>

        {/* Linked Timeline Events */}
        <Section label={`Timeline Events (${linkedEvents.length})`}>
          {linkedEvents.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--brown-300)' }}>No timeline events linked.</p>
            : linkedEvents.map(ev => (
              <button key={ev.id} onClick={() => onViewTimeline(ev.id)} style={{
                width: '100%', textAlign: 'left', padding: '9px 10px',
                background: 'var(--brown-50)', border: '1px solid var(--brown-100)',
                borderRadius: 7, marginBottom: 7, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', transition: 'border-color 150ms',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brown-300)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brown-100)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-400)' }}>
                    {formatTime(ev.timestamp)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: 'var(--brown-100)', color: 'var(--brown-500)', textTransform: 'capitalize' }}>
                    {ev.event_type}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--brown-600)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.description}
                </p>
                <p style={{ fontSize: 10, color: 'var(--brown-400)', marginTop: 3 }}>
                  {formatTimestamp(ev.timestamp)} · View in Timeline →
                </p>
              </button>
            ))
          }
        </Section>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-300)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: 'var(--brown-400)' }}>{label}</span>
      {children}
    </div>
  );
}
