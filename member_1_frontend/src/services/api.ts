import type {
  EvidenceCollection, EvidenceItem, EvidenceType, InvestigationReport,
  SceneData, TimelineData, TimelineEvent, UploadSession,
} from '../types';

const API_BASE = (
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://nivi-hackathon-api.onrender.com')
).replace(/\/+$/, '');
const API_ROOT = `${API_BASE}/api/v1`;

export const API_CONFIGURED = Boolean(API_BASE);

interface ApiEnvelope<T> {
  data: T;
}

interface BackendCase {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface BackendEvidence {
  id: string;
  case_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface BackendJob {
  id: string;
  case_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  adapter_mode: 'mock' | 'real';
  current_stage: string | null;
  completed_at: string | null;
  error?: { code: string; message: string } | null;
  stage_outcomes: Array<{ status: string }>;
}

interface BackendTimelineEvent {
  id: string;
  timestamp: string | null;
  summary: string;
  epistemic_status: 'OBSERVED' | 'INFERRED' | 'UNKNOWN';
  source_evidence_ids: string[];
}

interface BackendTimeline {
  events: BackendTimelineEvent[];
}

interface BackendFinding {
  id: string;
  statement: string;
  epistemic_status: 'OBSERVED' | 'INFERRED' | 'UNKNOWN';
  source_evidence_ids: string[];
}

interface BackendInvestigation {
  findings: BackendFinding[];
}

interface BackendSceneObject {
  id: string;
  label: string;
  epistemic_status: 'OBSERVED' | 'INFERRED' | 'UNKNOWN';
  source_evidence_ids: string[];
  position: Record<string, number> | null;
}

interface BackendScene {
  objects: BackendSceneObject[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_CONFIGURED) {
    throw new Error(
      'Evidence processing needs a backend URL. Configure VITE_API_URL to the deployed API and rebuild the dashboard.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, init);
  } catch (error) {
    throw new Error(
      `Could not connect to the evidence-processing backend at ${API_BASE}. Check that it is online and allows this site in CORS settings. ${String(error)}`,
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as {
      error?: { message?: string };
      detail?: { message?: string } | string;
    } | undefined;
    const message = body?.error?.message ??
      (typeof body?.detail === 'string' ? body.detail : body?.detail?.message);
    throw new Error(message ? `API ${response.status}: ${message}` : `API request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  const envelope = await response.json() as ApiEnvelope<T>;
  return envelope.data;
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function evidenceType(item: BackendEvidence): EvidenceType {
  if (item.content_type.startsWith('image/')) return 'image';
  if (item.content_type.startsWith('video/')) return 'video';
  const extension = item.filename.split('.').pop()?.toLowerCase();
  if (extension && ['csv', 'json', 'log'].includes(extension)) return 'sensor';
  return 'document';
}

function toEvidenceItem(item: BackendEvidence): EvidenceItem {
  const storedMetadata = {
    ...item.metadata,
    size_bytes: item.size_bytes,
    sha256: item.sha256,
    uploaded_at: item.created_at,
    content_type: item.content_type,
  };
  return {
    id: item.id,
    type: evidenceType(item),
    source_file: item.filename,
    confidence: undefined,
    tags: ['uploaded', 'not analyzed'],
    description: 'Original evidence file stored. No evidence-analysis adapter is configured.',
    metadata: storedMetadata,
  };
}

function stageDescription(stage: string | null): string {
  if (!stage) return 'Waiting for processing';
  return stage.replace(/_/g, ' ');
}

function toUploadSession(job: BackendJob): UploadSession {
  const completedStages = job.stage_outcomes.filter(stage => stage.status === 'completed').length;
  const status: UploadSession['status'] =
    job.status === 'completed' ? 'ready' :
    job.status === 'failed' ? 'failed' :
    job.status === 'queued' ? 'uploading' : 'processing';
  return {
    session_id: job.case_id,
    status,
    progress: status === 'ready' ? 100 : Math.min(95, completedStages * 18),
    stage: stageDescription(job.current_stage),
    error: job.error?.message,
  };
}

export async function uploadFiles(files: File[]): Promise<UploadSession> {
  if (files.length === 0) throw new Error('Select at least one evidence file.');

  const investigation = await request<BackendCase>(
    '/cases',
    jsonRequest('POST', {
      title: `NIVI investigation ${new Date().toISOString()}`,
      description: 'Evidence uploaded through the NIVI investigation dashboard.',
    }),
  );

  try {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      await request<BackendEvidence>(`/cases/${investigation.id}/evidence`, {
        method: 'POST',
        body: form,
      });
    }
  } catch (error) {
    try {
      await request<void>(`/cases/${investigation.id}`, { method: 'DELETE' });
    } catch (cleanupError) {
      throw new Error(
        `${String(error)} The partially created case ${investigation.id} could not be removed: ${String(cleanupError)}`,
      );
    }
    throw error;
  }

  return {
    session_id: investigation.id,
    status: 'uploading',
    progress: 10,
    stage: `${files.length} evidence file${files.length === 1 ? '' : 's'} uploaded`,
  };
}

export async function triggerPipeline(caseId: string): Promise<void> {
  await request<BackendJob>(`/cases/${caseId}/process`, { method: 'POST' });
}

export async function getSession(caseId: string): Promise<UploadSession> {
  const job = await request<BackendJob>(`/cases/${caseId}/status`);
  if (!job) throw new Error('The backend has not created a processing job for this case.');
  return toUploadSession(job);
}

export async function getEvidence(caseId: string): Promise<EvidenceCollection> {
  const items: BackendEvidence[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await request<{
      items: BackendEvidence[];
      total: number;
    }>(`/cases/${caseId}/evidence?page=${page}&page_size=100`);
    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);

  return {
    investigation_id: caseId,
    items: items.map(toEvidenceItem),
    processed_at: new Date().toISOString(),
    total_count: total,
  };
}

async function getGeneratedAt(caseId: string): Promise<string> {
  const job = await request<BackendJob>(`/cases/${caseId}/status`);
  return job.completed_at ?? new Date().toISOString();
}

export async function getTimeline(caseId: string): Promise<TimelineData> {
  const [timeline, generatedAt] = await Promise.all([
    request<BackendTimeline>(`/cases/${caseId}/timeline`),
    getGeneratedAt(caseId),
  ]);
  const events: TimelineEvent[] = timeline.events.map(event => ({
    id: event.id,
    timestamp: event.timestamp ?? undefined,
    description: event.summary,
    evidence_ids: event.source_evidence_ids,
    entities: [],
    confidence: undefined,
    event_type: event.epistemic_status === 'INFERRED' ? 'inferred' :
      event.epistemic_status === 'UNKNOWN' ? 'secondary' : 'primary',
  }));
  const timestamps = events
    .map(event => event.timestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort();
  return {
    investigation_id: caseId,
    events,
    start_time: timestamps[0] ?? '',
    end_time: timestamps[timestamps.length - 1] ?? '',
    generated_at: generatedAt,
  };
}

export async function getInvestigation(caseId: string): Promise<InvestigationReport> {
  const [investigation, job] = await Promise.all([
    request<BackendInvestigation>(`/cases/${caseId}/findings`),
    request<BackendJob>(`/cases/${caseId}/status`),
  ]);
  const findings = investigation.findings.map(finding => finding.statement);
  return {
    investigation_id: caseId,
    summary: findings.length
      ? 'Findings from the configured processing adapter. Review each finding and its linked source evidence.'
      : job.adapter_mode === 'mock'
        ? 'Evidence was received and the mock processing pipeline completed. No analysis adapter is configured to produce findings, so no forensic conclusions have been drawn.'
        : 'The configured processing adapters completed without returning findings. No forensic conclusions have been drawn.',
    confidence_score: undefined,
    contradictions: [],
    gaps: [],
    questions: [],
    key_findings: findings,
    generated_at: job.completed_at ?? new Date().toISOString(),
  };
}

export async function getScene(caseId: string): Promise<SceneData> {
  const [scene, generatedAt] = await Promise.all([
    request<BackendScene>(`/cases/${caseId}/scene`),
    getGeneratedAt(caseId),
  ]);
  return {
    investigation_id: caseId,
    generated_at: generatedAt,
    objects: scene.objects.flatMap(object => {
      const x = object.position?.['x'];
      const y = object.position?.['y'];
      if (typeof x !== 'number' || typeof y !== 'number') return [];
      return [{
        id: object.id,
        label: object.label,
        object_type: object.epistemic_status.toLowerCase(),
        position: { x, y },
        confidence: undefined,
        evidence_ids: object.source_evidence_ids,
      }];
    }),
  };
}
