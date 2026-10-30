import React from 'react';
import type { ActiveView, AppState } from '../../types';

const NAV_ITEMS = [
  { id: 'dashboard'     as ActiveView, label: 'Overview',       icon: '⊞' },
  { id: 'evidence'      as ActiveView, label: 'Evidence',        icon: '◈' },
  { id: 'timeline'      as ActiveView, label: 'Timeline',        icon: '⊳' },
  { id: 'scene'         as ActiveView, label: 'Scene Model',     icon: '⊡' },
  { id: 'investigation' as ActiveView, label: 'Investigation',   icon: '⊚' },
];

interface Props { state: AppState; onNavigate: (v: ActiveView) => void; }

export function Sidebar({ state, onNavigate }: Props) {
  const { activeView, evidenceCollection, timeline, investigation } = state;
  const hasData = !!evidenceCollection;

  const badges: Partial<Record<ActiveView, string | undefined>> = {
    evidence:      evidenceCollection ? String(evidenceCollection.total_count) : undefined,
    timeline:      timeline ? String(timeline.events.length) : undefined,
    investigation: investigation?.confidence_score === undefined
      ? undefined
      : `${Math.round(investigation.confidence_score * 100)}%`,
  };

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh',
      background: '#fff',
      borderRight: '1px solid var(--brown-200)',
      display: 'flex', flexDirection: 'column',
      padding: '0',
      position: 'sticky', top: 0, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--brown-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--brown-600)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1rem', fontWeight: 700, flexShrink: 0,
          }}>N</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brown-900)', letterSpacing: '0.02em' }}>NIVI</div>
            <div style={{ fontSize: 11, color: 'var(--brown-400)', fontFamily: 'var(--font-data)' }}>Reality Reconstructor</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--brown-100)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 10px', borderRadius: 6,
          background: hasData ? 'rgba(45,106,79,.08)' : 'var(--brown-50)',
          border: `1px solid ${hasData ? 'rgba(45,106,79,.2)' : 'var(--brown-200)'}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: hasData ? '#2d6a4f' : 'var(--brown-300)',
          }} />
          <span style={{ fontSize: 11, color: hasData ? '#2d6a4f' : 'var(--brown-400)', fontFamily: 'var(--font-data)' }}>
            {hasData ? 'Analysis Ready' : 'Awaiting Evidence'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 10px', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const disabled = !hasData && item.id !== 'dashboard';
          const active   = activeView === item.id;
          const badge    = badges[item.id];

          return (
            <button
              key={item.id}
              disabled={disabled}
              onClick={() => !disabled && onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px',
                borderRadius: 7, border: 'none',
                background: active ? 'var(--brown-100)' : 'transparent',
                color: active ? 'var(--brown-700)' : disabled ? 'var(--brown-300)' : 'var(--brown-600)',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                marginBottom: 2,
                transition: 'background var(--ease), color var(--ease)',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLElement).style.background = 'var(--brown-50)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '0.9rem', width: 16, textAlign: 'center', flexShrink: 0, opacity: disabled ? 0.4 : 1 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge && (
                <span style={{
                  fontFamily: 'var(--font-data)', fontSize: 10,
                  background: active ? 'var(--brown-200)' : 'var(--brown-100)',
                  color: 'var(--brown-500)', padding: '1px 6px', borderRadius: 10,
                }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--brown-100)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-data)', color: 'var(--brown-300)' }}>
          v1.0.0 · Hackathon Build
        </div>
      </div>
    </aside>
  );
}
