// ============================================================
// api.ts — all backend communication
// Fixes:
//   • triggerPipeline checks res.ok and throws on failure
//   • getScene validates the response shape against SceneData
// ============================================================

import type {
  EvidenceCollection, TimelineData, InvestigationReport,
  SceneData, SceneObject, UploadSession,
} from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Generic GET helper ─────────────────────────────────────
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}${text ? `: ${text}` : ''}`);
  }
  const json = await res.json();
  return json.data as T;
}

// ── Upload ─────────────────────────────────────────────────
export async function uploadFiles(files: File[]): Promise<UploadSession> {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status})${text ? `: ${text}` : ''}`);
  }
  const json = await res.json();
  return json.data as UploadSession;
}

// ── Pipeline trigger — now checks res.ok ───────────────────
export async function triggerPipeline(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pipeline trigger failed (${res.status})${text ? `: ${text}` : ''}`);
  }
}

// ── Data endpoints ─────────────────────────────────────────
export const getSession       = (id: string) => get<UploadSession>(`/api/session/${id}`);
export const getEvidence      = (id: string) => get<EvidenceCollection>(`/api/evidence/${id}`);
export const getTimeline      = (id: string) => get<TimelineData>(`/api/timeline/${id}`);
export const getInvestigation = (id: string) => get<InvestigationReport>(`/api/investigation/${id}`);

// ── Scene — validates response shape before returning ──────
export async function getScene(id: string): Promise<SceneData> {
  const raw = await get<unknown>(`/api/scene/${id}`);
  return validateSceneData(raw);
}

// ── SceneData validator ────────────────────────────────────
// Guards against malformed API responses reaching the Three.js
// renderer which would cause cryptic runtime errors.
function validateSceneData(raw: unknown): SceneData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scene response is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['investigation_id'] !== 'string') {
    throw new Error('Scene response missing investigation_id (string)');
  }
  if (typeof r['generated_at'] !== 'string') {
    throw new Error('Scene response missing generated_at (string)');
  }
  if (!Array.isArray(r['objects'])) {
    throw new Error('Scene response missing objects (array)');
  }

  // Validate each object
  const objects: SceneObject[] = (r['objects'] as unknown[]).map((obj, idx) => {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`Scene object[${idx}] is not an object`);
    }
    const o = obj as Record<string, unknown>;

    if (typeof o['id'] !== 'string')    throw new Error(`Scene object[${idx}].id must be a string`);
    if (typeof o['label'] !== 'string') throw new Error(`Scene object[${idx}].label must be a string`);
    if (typeof o['object_type'] !== 'string') throw new Error(`Scene object[${idx}].object_type must be a string`);
    if (typeof o['confidence'] !== 'number')  throw new Error(`Scene object[${idx}].confidence must be a number`);

    const pos = o['position'] as Record<string, unknown> | undefined;
    if (!pos || typeof pos['x'] !== 'number' || typeof pos['y'] !== 'number') {
      throw new Error(`Scene object[${idx}].position must have numeric x and y`);
    }

    if (!Array.isArray(o['evidence_ids'])) {
      throw new Error(`Scene object[${idx}].evidence_ids must be an array`);
    }

    const dims = o['dimensions'] as Record<string, unknown> | undefined;

    return {
      id:           o['id'] as string,
      label:        o['label'] as string,
      object_type:  o['object_type'] as string,
      confidence:   o['confidence'] as number,
      position:     { x: pos['x'] as number, y: pos['y'] as number },
      evidence_ids: (o['evidence_ids'] as unknown[]).filter(e => typeof e === 'string') as string[],
      dimensions: dims && typeof dims['width'] === 'number' && typeof dims['height'] === 'number'
        ? { width: dims['width'] as number, height: dims['height'] as number }
        : undefined,
    };
  });

  const roomDims = r['room_dimensions'] as Record<string, unknown> | undefined;

  return {
    investigation_id: r['investigation_id'] as string,
    generated_at:     r['generated_at'] as string,
    objects,
    room_dimensions: roomDims && typeof roomDims['width'] === 'number' && typeof roomDims['height'] === 'number'
      ? { width: roomDims['width'] as number, height: roomDims['height'] as number }
      : undefined,
  };
}
