// ============================================================
// App.tsx — root shell
// Wires all six fixes through the component tree:
//   Fix 1: uploadFiles passed to Dashboard as onUpload
//   Fix 2/4: resetInvestigation called inside loadDemo/uploadFiles
//   Fix 3: triggerPipeline failure surfaced via state.error
//   Fix 5: retryScene passed to SceneViewer as onRetry
//   Fix 6: selection from shared state flows into all views
// ============================================================

import React, { useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { EvidenceLibrary } from './components/evidence/EvidenceLibrary';
import { TimelineView } from './components/timeline/Timeline';
import { SceneViewer } from './components/scene/SceneViewer';
import { InvestigationReportView } from './components/investigation/InvestigationReport';
import { useInvestigation } from './hooks/useInvestigation';
import type { ActiveView } from './types';
import './styles/global.css';

export default function App() {
  const {
    state,
    setActiveView,
    loadDemo,
    uploadFiles,           // Fix 1
    retryScene,            // Fix 5
    selectSceneObject,
    selectEvidenceItem,
    selectTimelineEvent,
    clearSelection,
  } = useInvestigation();

  const {
    activeView, evidenceCollection,
    timeline, investigation, scene,
    sceneLoading, sceneError, selection,
  } = state;

  // Navigate AND highlight — called by ObjectInspector cross-links
  const handleInspectorNavigate = useCallback((view: ActiveView, highlightId?: string) => {
    setActiveView(view);
    if (!highlightId) return;
    if (view === 'evidence' && evidenceCollection) {
      const item = evidenceCollection.items.find(i => i.id === highlightId);
      if (item) selectEvidenceItem(item);
    } else if (view === 'timeline' && timeline) {
      const ev = timeline.events.find(e => e.id === highlightId);
      if (ev) selectTimelineEvent(ev);
    }
  }, [setActiveView, evidenceCollection, timeline, selectEvidenceItem, selectTimelineEvent]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
      <Sidebar state={state} onNavigate={setActiveView} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 42, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 32px',
          background: '#fff', borderBottom: '1px solid var(--brown-100)', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--brown-300)', letterSpacing: '.06em' }}>
            NIVI · {activeView.toUpperCase()}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selection.sceneObjectId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'var(--brown-50)', border: '1px solid var(--brown-200)', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brown-500)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--brown-500)', fontFamily: 'var(--font-data)' }}>object selected</span>
                <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-300)', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            )}
            {selection.highlightedEventId && !selection.sceneObjectId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#b8860b11', border: '1px solid #b8860b44', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b8860b', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#b8860b', fontFamily: 'var(--font-data)' }}>event linked</span>
                <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b8860b88', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            )}
            {selection.highlightedEvidenceIds.length > 0 && !selection.highlightedEventId && !selection.sceneObjectId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#b8860b11', border: '1px solid #b8860b44', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b8860b', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#b8860b', fontFamily: 'var(--font-data)' }}>
                  {selection.highlightedEvidenceIds.length} evidence linked
                </span>
                <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b8860b88', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            )}
            {state.session && (
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--brown-300)' }}>
                {state.session.session_id}
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', background: 'var(--bg-subtle)' }}>

          {activeView === 'dashboard' && (
            <Dashboard
              state={state}
              onNavigate={setActiveView}
              onUpload={uploadFiles}
              onDemo={loadDemo}
            />
          )}

          {activeView === 'evidence' && evidenceCollection && (
            <EvidenceLibrary
              items={evidenceCollection.items}
              selection={selection}
              onSelectItem={selectEvidenceItem}
            />
          )}

          {activeView === 'timeline' && timeline && (
            <TimelineView
              data={timeline}
              selection={selection}
              onSelectEvent={selectTimelineEvent}
            />
          )}

          {activeView === 'scene' && (
            <SceneViewer
              scene={scene ?? { investigation_id: '', objects: [], generated_at: '' }}
              sceneLoading={sceneLoading}
              sceneError={sceneError}
              selection={selection}
              evidenceItems={evidenceCollection?.items ?? []}
              timelineEvents={timeline?.events ?? []}
              onSelectObject={selectSceneObject}
              onNavigate={handleInspectorNavigate}
              onRetry={retryScene}
            />
          )}

          {activeView === 'investigation' && investigation && (
            <InvestigationReportView report={investigation} />
          )}
          {activeView !== 'dashboard' && activeView !== 'scene' && !evidenceCollection && !sceneLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <p style={{ color: 'var(--brown-300)', fontSize: 13, textAlign: 'center', maxWidth: '36ch', lineHeight: 1.7 }}>
                No data loaded yet. Return to the dashboard and upload files or click <strong>Load Demo Case</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
