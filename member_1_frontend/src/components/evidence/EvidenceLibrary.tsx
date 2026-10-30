// ============================================================
// EvidenceLibrary — emits onSelectItem so the scene highlights
// the matching 3D object. Items linked via scene selection are
// shown with an amber border.
// ============================================================

import React, { useState, useMemo } from 'react';
import type { EvidenceItem, EvidenceType, SceneSelection } from '../../types';
import { formatTimestamp, formatConfidence, confidenceLabel, evidenceTypeIcon } from '../../utils/helpers';

const FILTERS: Array<{ id: EvidenceType | 'all'; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'video', label: 'Video' },
  { id: 'image', label: 'Image' }, { id: 'document', label: 'Document' }, { id: 'sensor', label: 'Sensor' },
];

interface Props {
  items: EvidenceItem[];
  selection: SceneSelection;
  onSelectItem: (item: EvidenceItem | null) => void;
}

export function EvidenceLibrary({ items, selection, onSelectItem }: Props) {
  const [filter, setFilter]   = useState<EvidenceType | 'all'>('all');
  const [search, setSearch]   = useState('');
  // Fix 6: derive selected item from shared selection state, not local useState.
  // This ensures the detail panel stays in sync when selection changes externally
  // (e.g. clicking a scene object highlights the linked evidence).
  const selected = items.find(it => selection.highlightedEvidenceIds.includes(it.id) && !selection.sceneObjectId) ??
                   items.find(it => selection.highlightedEvidenceIds[0] === it.id) ??
                   null;

  const filtered = useMemo(() => items.filter(it => {
    const matchType   = filter === 'all' || it.type === filter;
    const q           = search.toLowerCase();
    const matchSearch = !q || it.description.toLowerCase().includes(q) || it.source_file.toLowerCase().includes(q) || it.tags.some(t => t.includes(q));
    return matchType && matchSearch;
  }), [items, filter, search]);

  const handleSelect = (item: EvidenceItem) => {
    // If already selected via shared state, clicking again clears it
    const isAlreadySelected = selection.highlightedEvidenceIds.includes(item.id);
    onSelectItem(isAlreadySelected ? null : item);
  };

  // An item is "linked" if the current scene/timeline selection references it
  const isLinked = (id: string) => selection.highlightedEvidenceIds.includes(id);

  return (
    <div style={{ display: 'flex', width: '100%', overflow: 'hidden', animation: 'fade-up .3s ease both' }}>

      {/* Main grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${filter === f.id ? 'var(--brown-600)' : 'var(--brown-200)'}`,
                background: filter === f.id ? 'var(--brown-600)' : '#fff',
                color: filter === f.id ? '#fff' : 'var(--brown-500)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 150ms',
              }}>
                {f.label}
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, opacity: .7 }}>
                  {f.id === 'all' ? items.length : items.filter(i => i.type === f.id).length}
                </span>
              </button>
            ))}
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search evidence…"
            style={{
              padding: '7px 14px', background: '#fff', border: '1px solid var(--brown-200)',
              borderRadius: 'var(--radius-md)', color: 'var(--brown-800)', fontSize: 13,
              fontFamily: 'var(--font-ui)', width: 210, outline: 'none', transition: 'border-color 150ms',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--brown-400)')}
            onBlur={e => (e.target.style.borderColor = 'var(--brown-200)')}
          />
        </div>

        {/* Linked hint */}
        {selection.highlightedEvidenceIds.length > 0 && (
          <div style={{ marginBottom: 16, padding: '8px 14px', background: 'var(--brown-50)', border: '1px solid #b8860b44', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#b8860b', fontFamily: 'var(--font-data)' }}>●</span>
            <span style={{ fontSize: 12, color: 'var(--brown-600)' }}>
              {selection.highlightedEvidenceIds.length} item{selection.highlightedEvidenceIds.length !== 1 ? 's' : ''} linked from {selection.highlightedEventId ? 'timeline selection' : 'scene selection'}
            </span>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0
          ? <p style={{ color: 'var(--brown-300)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No evidence matches your filter.</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {filtered.map(item => (
                <EvCard
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  linked={isLinked(item.id)}
                  onClick={() => handleSelect(item)}
                />
              ))}
            </div>
          )
        }
      </div>

      {/* Detail panel */}
      {selected && <EvDetail item={selected} onClose={() => onSelectItem(null)} />}
    </div>
  );
}

function EvCard({ item, selected, linked, onClick }: { item: EvidenceItem; selected: boolean; linked: boolean; onClick: () => void }) {
  const score = item.confidence;
  const conf = score === undefined ? undefined : confidenceLabel(score);
  return (
    <button onClick={onClick} style={{
      background: '#fff',
      border: `1px solid ${selected ? 'var(--brown-500)' : linked ? '#b8860b88' : 'var(--brown-200)'}`,
      borderLeft: linked ? '3px solid #b8860b' : undefined,
      borderRadius: 'var(--radius-lg)', padding: 16, textAlign: 'left',
      cursor: 'pointer', width: '100%', fontFamily: 'var(--font-ui)',
      display: 'flex', flexDirection: 'column', gap: 9,
      boxShadow: selected ? 'var(--shadow-sm)' : 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
    }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = linked ? '#b8860b' : 'var(--brown-300)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = linked ? '#b8860b88' : 'var(--brown-200)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--brown-100)', color: 'var(--brown-600)', textTransform: 'capitalize' }}>
            {evidenceTypeIcon(item.type)} {item.type}
          </span>
          {linked && <span style={{ fontSize: 10, color: '#b8860b', fontFamily: 'var(--font-data)' }}>● linked</span>}
        </div>
        {conf && score !== undefined
          ? <span style={{ fontSize: 11, fontFamily: 'var(--font-data)', color: conf.color, fontWeight: 500 }}>{conf.label} · {formatConfidence(score)}</span>
          : <span style={{ fontSize: 11, fontFamily: 'var(--font-data)', color: 'var(--brown-300)' }}>Not analyzed</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--brown-600)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {item.description}
      </p>
      <div>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.source_file}</p>
        {item.timestamp && <p style={{ fontSize: 11, color: 'var(--brown-300)', marginTop: 2 }}>{formatTimestamp(item.timestamp)}</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {item.tags.slice(0, 4).map(tag => (
          <span key={tag} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-400)', fontFamily: 'var(--font-data)' }}>{tag}</span>
        ))}
      </div>
    </button>
  );
}

function EvDetail({ item, onClose }: { item: EvidenceItem; onClose: () => void }) {
  const score = item.confidence;
  const conf = score === undefined ? undefined : confidenceLabel(score);
  return (
    <aside style={{ width: 300, minWidth: 300, background: '#fff', borderLeft: '1px solid var(--brown-200)', padding: 22, overflowY: 'auto', animation: 'slide-in .25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown-800)' }}>Evidence Detail</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-300)', fontSize: 14 }}>✕</button>
      </div>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)', marginBottom: 20 }}>{item.id}</p>
      <R label="Source File"  value={item.source_file} mono />
      <R label="Type"         value={`${evidenceTypeIcon(item.type)} ${item.type}`} />
      {item.timestamp && <R label="Captured At" value={formatTimestamp(item.timestamp)} mono />}
      {conf && score !== undefined && (
      <div style={{ marginBottom: 14 }}>
        <L>Confidence</L>
        <div style={{ height: 3, background: 'var(--brown-100)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', background: conf.color, width: formatConfidence(score), borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-data)', color: conf.color }}>{formatConfidence(score)} — {conf.label}</span>
      </div>
      )}
      <R label="Description" value={item.description} />
      {item.location && <R label="Position" value={`x=${item.location.x}  y=${item.location.y}${item.location.z !== undefined ? `  z=${item.location.z}` : ''}`} mono />}
      {item.extracted_text && (
        <div style={{ marginBottom: 14 }}>
          <L>Extracted Text</L>
          <pre style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-600)', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {item.extracted_text}
          </pre>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <L>Tags</L>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {item.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 3, color: 'var(--brown-400)', fontFamily: 'var(--font-data)' }}>{t}</span>)}
        </div>
      </div>
      <div>
        <L>Metadata</L>
        <pre style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-400)', background: 'var(--brown-50)', border: '1px solid var(--brown-100)', borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          {JSON.stringify(item.metadata, null, 2)}
        </pre>
      </div>
    </aside>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--brown-300)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{children}</label>;
}
function R({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <L>{label}</L>
      <span style={{ fontSize: 12, color: 'var(--brown-600)', lineHeight: 1.5, fontFamily: mono ? 'var(--font-data)' : 'var(--font-ui)' }}>{value}</span>
    </div>
  );
}
