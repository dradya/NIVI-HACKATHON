// ============================================================
// useInvestigation — central state + cross-component linking
//
// Fixes applied:
//   1. uploadFiles() is exposed and wired — Dashboard receives it
//   2. Starting a new investigation resets scene + selection
//   3. triggerPipeline failure is caught and surfaced as error
//   4. scene is cleared (not retained) when a new upload starts
//   5. retryScene() lets the user retry a failed scene fetch
//   6. Selection IDs are synchronised with shared state;
//      localSelected in child components is derived from here
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  AppState, ActiveView, SceneSelection,
  SceneObject, EvidenceItem, TimelineEvent,
} from '../types';
import {
  MOCK_EVIDENCE, MOCK_TIMELINE, MOCK_INVESTIGATION, MOCK_SCENE,
} from '../services/mockData';
import * as api from '../services/api';

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export const EMPTY_SELECTION: SceneSelection = {
  sceneObjectId: null,
  highlightedEvidenceIds: [],
  highlightedEventId: null,
};

// Initial state — exported so tests can reference it
export const INITIAL_STATE: AppState = {
  activeView: 'dashboard',
  isLoading:    false,
  sceneLoading: false,
  selection:    EMPTY_SELECTION,
};

export function useInvestigation() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const pollRef     = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Keep the current session ID so retryScene() can re-fetch
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const setActiveView = useCallback((view: ActiveView) => {
    setState(s => ({ ...s, activeView: view }));
  }, []);

  // ── Shared reset helper (Fix 2 & 4) ──────────────────────
  // Wipes all investigation data, scene, and selection so a new
  // upload never inherits stale state from the previous session.
  const resetInvestigation = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    sessionIdRef.current = null;
    setState({
      ...INITIAL_STATE,
      activeView: 'dashboard',
    });
  }, []);

  // ── Demo pipeline ─────────────────────────────────────────
  const loadDemo = useCallback(async () => {
    resetInvestigation();            // clear any previous session first

    const stages = [
      { stage: 'Ingesting evidence files…',       progress: 15 },
      { stage: 'Running OCR on documents…',       progress: 32 },
      { stage: 'Extracting video keyframes…',     progress: 50 },
      { stage: 'Processing sensor logs…',         progress: 64 },
      { stage: 'Building temporal timeline…',     progress: 76 },
      { stage: 'Running contradiction analysis…', progress: 88 },
      { stage: 'Generating 3D scene model…',      progress: 96 },
      { stage: 'Complete.',                        progress: 100 },
    ];

    const session = {
      session_id: 'demo_session_001',
      status: 'processing' as const,
      progress: 0,
      stage: 'Starting…',
    };

    sessionIdRef.current = 'demo_session_001';  // allows retryScene to work in demo mode
    setState(s => ({ ...s, isLoading: true, sceneLoading: true, session }));

    for (const step of stages) {
      await delay(420 + Math.random() * 320);
      setState(s => ({ ...s, session: { ...session, ...step } }));
    }

    await delay(300);
    setState(s => ({
      ...s,
      isLoading: false,
      sceneLoading: false,
      session: { ...session, status: 'ready', progress: 100, stage: 'Ready' },
      evidenceCollection: MOCK_EVIDENCE,
      timeline:           MOCK_TIMELINE,
      investigation:      MOCK_INVESTIGATION,
      scene:              MOCK_SCENE,
      error:              undefined,
      sceneError:         undefined,
    }));
  }, [resetInvestigation]);

  // ── Real upload flow (Fix 1 — exposed for Dashboard) ─────
  const uploadFiles = useCallback(async (files: File[]) => {
    resetInvestigation();            // Fix 2 & 4: clear stale state first

    setState(s => ({
      ...s,
      isLoading:    true,
      sceneLoading: true,
      error:        undefined,
      sceneError:   undefined,
    }));

    let session;
    try {
      session = await api.uploadFiles(files);
    } catch (err) {
      setState(s => ({ ...s, isLoading: false, sceneLoading: false, error: String(err) }));
      return;
    }

    // Fix 3: catch triggerPipeline failure
    try {
      await api.triggerPipeline(session.session_id);
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false, sceneLoading: false,
        error: `Pipeline could not be started: ${String(err)}`,
      }));
      return;
    }

    sessionIdRef.current = session.session_id;
    setState(s => ({ ...s, session }));

    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.getSession(session.session_id);
        setState(s => ({ ...s, session: updated }));

        if (updated.status === 'ready') {
          clearInterval(pollRef.current!);
          await loadAllData(session.session_id);
        } else if (updated.status === 'failed') {
          clearInterval(pollRef.current!);
          setState(s => ({
            ...s,
            isLoading: false, sceneLoading: false,
            error: 'Processing pipeline failed. Check the backend logs.',
          }));
        }
      } catch {
        clearInterval(pollRef.current!);
        setState(s => ({
          ...s,
          isLoading: false, sceneLoading: false,
          error: 'Lost connection to the backend while polling for status.',
        }));
      }
    }, 2000);
  }, [resetInvestigation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load all data after pipeline completes ────────────────
  const loadAllData = async (sessionId: string) => {
    // Fetch evidence, timeline, investigation in parallel.
    // Scene is fetched separately so its error state is isolated.
    const [evidenceCollection, timeline, investigation] = await Promise.all([
      api.getEvidence(sessionId),
      api.getTimeline(sessionId),
      api.getInvestigation(sessionId),
    ]);

    setState(s => ({
      ...s,
      isLoading: false,
      evidenceCollection,
      timeline,
      investigation,
    }));

    // Fetch scene separately — a scene error should not block the rest of the UI
    try {
      const scene = await api.getScene(sessionId);
      setState(s => ({ ...s, sceneLoading: false, scene, sceneError: undefined }));
    } catch (err) {
      setState(s => ({
        ...s,
        sceneLoading: false,
        scene: undefined,              // Fix 4: never retain a stale scene
        sceneError: String(err),
      }));
    }
  };

  // ── Retry scene fetch (Fix 5) ─────────────────────────────
  const retryScene = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    setState(s => ({ ...s, sceneLoading: true, sceneError: undefined, scene: undefined }));

    // Demo mode — restore mock scene instantly without hitting the API
    if (sessionId === 'demo_session_001') {
      await new Promise(r => setTimeout(r, 600));
      setState(s => ({ ...s, sceneLoading: false, scene: MOCK_SCENE, sceneError: undefined }));
      return;
    }

    try {
      const scene = await api.getScene(sessionId);
      setState(s => ({ ...s, sceneLoading: false, scene, sceneError: undefined }));
    } catch (err) {
      setState(s => ({ ...s, sceneLoading: false, sceneError: String(err) }));
    }
  }, []);

  // ── Cross-component selection (Fix 6) ────────────────────
  // All selection changes go through here — child components
  // derive their "selected" display from selection in shared state,
  // eliminating the dual-state inconsistency.

  const selectSceneObject = useCallback((obj: SceneObject | null) => {
    setState(s => ({
      ...s,
      selection: {
        sceneObjectId:          obj?.id ?? null,
        highlightedEvidenceIds: obj?.evidence_ids ?? [],
        highlightedEventId:     null,
      },
    }));
  }, []);

  const selectEvidenceItem = useCallback((item: EvidenceItem | null) => {
    setState(s => {
      if (!item) return { ...s, selection: EMPTY_SELECTION };
      const linked = s.scene?.objects.find(o => o.evidence_ids.includes(item.id));
      return {
        ...s,
        selection: {
          sceneObjectId:          linked?.id ?? null,
          highlightedEvidenceIds: [item.id],
          highlightedEventId:     null,
        },
      };
    });
  }, []);

  const selectTimelineEvent = useCallback((event: TimelineEvent | null) => {
    setState(s => {
      if (!event) return { ...s, selection: EMPTY_SELECTION };
      const evIds  = event.evidence_ids;
      const linked = s.scene?.objects.find(o =>
        o.evidence_ids.some(id => evIds.includes(id))
      );
      const byLocation = event.location
        ? s.scene?.objects.reduce<{ obj: SceneObject | null; dist: number }>(
            (best, o) => {
              const d = Math.hypot(
                o.position.x - event.location!.x,
                o.position.y - event.location!.y
              );
              return d < best.dist ? { obj: o, dist: d } : best;
            },
            { obj: null, dist: Infinity }
          )
        : null;
      const resolved = linked ?? byLocation?.obj ?? null;
      return {
        ...s,
        selection: {
          sceneObjectId:          resolved?.id ?? null,
          highlightedEvidenceIds: evIds,
          highlightedEventId:     event.id,
        },
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState(s => ({ ...s, selection: EMPTY_SELECTION }));
  }, []);

  const reset = useCallback(() => {
    resetInvestigation();
  }, [resetInvestigation]);

  return {
    state,
    setActiveView,
    loadDemo,
    uploadFiles,       // Fix 1: now exposed
    retryScene,        // Fix 5: exposed for SceneViewer retry button
    selectSceneObject,
    selectEvidenceItem,
    selectTimelineEvent,
    clearSelection,
    reset,
  };
}
