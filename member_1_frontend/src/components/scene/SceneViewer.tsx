// ============================================================
// SceneViewer.tsx
// Orchestrates:
//   - ThreeScene (3D renderer)
//   - ObjectInspector (detail panel)
//   - Loading / error states
//   - Toolbar with view mode + legend
//   - Cross-links: scene ↔ evidence ↔ timeline
// ============================================================

import React, { useState } from 'react';
import { ThreeScene } from './ThreeScene';
import { ObjectInspector } from './ObjectInspector';
import type { SceneData, SceneObject, SceneSelection, EvidenceItem, TimelineEvent, ActiveView } from '../../types';

const OBJ_COLORS: Record<string, string> = {
  door:      '#8b6b4f',
  inventory: '#b8860b',
  camera:    '#4a7c59',
  sensor:    '#6b4f35',
  vehicle:   '#9e7b5e',
};

interface Props {
  scene: SceneData;
  sceneLoading: boolean;
  sceneError?: string;
  selection: SceneSelection;
  evidenceItems: EvidenceItem[];
  timelineEvents: TimelineEvent[];
  onSelectObject: (obj: SceneObject | null) => void;
  onNavigate: (view: ActiveView, highlightId?: string) => void;
  onRetry: () => void;   // Fix 5: retry failed scene fetch
}

export function SceneViewer({
  scene, sceneLoading, sceneError,
  selection, evidenceItems, timelineEvents,
  onSelectObject, onNavigate, onRetry,
}: Props) {
  const [showLegend, setShowLegend] = useState(true);

  // Derive the selected SceneObject from selection state
  const selectedObject = selection.sceneObjectId
    ? scene.objects.find(o => o.id === selection.sceneObjectId) ?? null
    : null;

  // ── Loading state ─────────────────────────────────────────
  if (sceneLoading) {
    return (
      <div style={centeredContainer}>
        <div style={{ textAlign: 'center' }}>
          <div style={spinner} />
          <p style={{ fontSize: 13, color: 'var(--brown-500)', marginTop: 16, fontWeight: 500 }}>
            Building 3D scene model…
          </p>
          <p style={{ fontSize: 11, color: 'var(--brown-300)', marginTop: 6, fontFamily: 'var(--font-data)' }}>
            Parsing scene JSON · Placing objects · Calculating lighting
          </p>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (sceneError) {
    return (
      <div style={centeredContainer}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '2rem', marginBottom: 14, opacity: .5 }}>⚠</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown-800)', marginBottom: 8 }}>
            Scene failed to load
          </p>
          <p style={{ fontSize: 12, color: 'var(--brown-400)', lineHeight: 1.6, marginBottom: 20 }}>
            {sceneError}
          </p>
          <p style={{ fontSize: 11, color: 'var(--brown-300)', fontFamily: 'var(--font-data)', marginBottom: 20 }}>
            Check that the backend /api/scene endpoint is reachable and returns valid JSON matching the SceneData schema.
          </p>
          <button onClick={onRetry} style={{
            padding: '9px 22px', borderRadius: 'var(--radius-md)',
            background: 'var(--brown-600)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'opacity 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Retry Scene Fetch
          </button>
        </div>
      </div>
    );
  }

  // ── No scene data ─────────────────────────────────────────
  if (!scene || scene.objects.length === 0) {
    return (
      <div style={centeredContainer}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12, opacity: .35 }}>⊡</div>
          <p style={{ fontSize: 13, color: 'var(--brown-400)' }}>No scene data available yet.</p>
        </div>
      </div>
    );
  }

  // ── Active selection banner ───────────────────────────────
  const hasSelection     = !!selection.sceneObjectId;
  const hasLinked        = selection.highlightedEvidenceIds.length > 0 && !hasSelection;
  const linkedObjCount   = selection.highlightedEvidenceIds.length > 0
    ? scene.objects.filter(o => o.evidence_ids.some(e => selection.highlightedEvidenceIds.includes(e))).length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', animation: 'fade-up .3s ease both' }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: '12px 24px', background: '#fff',
        borderBottom: '1px solid var(--brown-100)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--brown-900)' }}>
            3D Scene Model{' '}
            <span style={{ fontSize: 13, color: 'var(--brown-400)', fontWeight: 400 }}>
              — {scene.room_dimensions?.width}m × {scene.room_dimensions?.height}m
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Legend toggle */}
          <button onClick={() => setShowLegend(l => !l)} style={toolbarBtn}>
            {showLegend ? 'Hide Legend' : 'Show Legend'}
          </button>

          {/* Object count */}
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)', paddingLeft: 8 }}>
            {scene.objects.length} objects
          </span>
        </div>
      </div>

      {/* ── Cross-link banner ── */}
      {(hasSelection || hasLinked) && (
        <div style={{
          padding: '8px 24px', background: 'var(--brown-50)',
          borderBottom: '1px solid var(--brown-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--brown-600)' }}>
            {hasSelection
              ? `Viewing: ${selectedObject?.label ?? selection.sceneObjectId}`
              : `${linkedObjCount} object${linkedObjCount !== 1 ? 's' : ''} linked from ${
                  selection.highlightedEventId ? 'timeline event' : 'evidence selection'
                }`
            }
          </span>
          <button onClick={() => onSelectObject(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--brown-400)', fontFamily: 'var(--font-ui)',
          }}>
            Clear ✕
          </button>
        </div>
      )}

      {/* ── Main body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Legend */}
        {showLegend && (
          <div style={{
            width: 160, minWidth: 160, background: '#fff',
            borderRight: '1px solid var(--brown-100)',
            padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 9,
            overflowY: 'auto', flexShrink: 0,
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
              Legend
            </p>
            {Object.entries(OBJ_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--brown-500)', textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, borderTop: '1px solid var(--brown-100)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6b4f35', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--brown-500)' }}>Selected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#b8860b', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--brown-500)' }}>Linked</span>
              </div>
            </div>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--brown-100)', paddingTop: 10 }}>
              <p style={{ fontSize: 10, color: 'var(--brown-300)', lineHeight: 1.6 }}>
                Drag to orbit<br />Scroll to zoom<br />Click to select
              </p>
            </div>
          </div>
        )}

        {/* Three.js canvas */}
        <ThreeScene
          scene={scene}
          selection={selection}
          onSelectObject={onSelectObject}
        />

        {/* Inspector panel */}
        {selectedObject && (
          <ObjectInspector
            object={selectedObject}
            evidenceItems={evidenceItems}
            timelineEvents={timelineEvents}
            onClose={() => onSelectObject(null)}
            onViewEvidence={id => onNavigate('evidence', id)}
            onViewTimeline={id => onNavigate('timeline', id)}
          />
        )}
      </div>
    </div>
  );
}

const centeredContainer: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flex: 1, background: 'var(--brown-50)',
  animation: 'fade-up .3s ease both',
};

const spinner: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  border: '3px solid var(--brown-100)',
  borderTopColor: 'var(--brown-500)',
  animation: 'spin .8s linear infinite',
  margin: '0 auto',
};

const toolbarBtn: React.CSSProperties = {
  padding: '5px 12px', background: '#fff',
  border: '1px solid var(--brown-200)',
  borderRadius: 'var(--radius-md)', color: 'var(--brown-500)',
  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
};
