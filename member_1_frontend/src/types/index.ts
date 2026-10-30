export type EvidenceType = 'image' | 'video' | 'document' | 'sensor';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  source_file: string;
  timestamp?: string;
  location?: { x: number; y: number; z?: number };
  confidence: number;
  tags: string[];
  description: string;
  extracted_text?: string;
  metadata: Record<string, unknown>;
}

export interface EvidenceCollection {
  investigation_id: string;
  items: EvidenceItem[];
  processed_at: string;
  total_count: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  duration_seconds?: number;
  description: string;
  evidence_ids: string[];
  entities: string[];
  confidence: number;
  event_type: 'primary' | 'secondary' | 'inferred';
  location?: { x: number; y: number };
}

export interface TimelineData {
  investigation_id: string;
  events: TimelineEvent[];
  start_time: string;
  end_time: string;
  generated_at: string;
}

export interface Contradiction {
  id: string;
  evidence_ids: string[];
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface Gap {
  id: string;
  timerange?: { start: string; end: string };
  description: string;
  suggested_evidence_types: EvidenceType[];
}

export interface InvestigationQuestion {
  id: string;
  question: string;
  priority: 'high' | 'medium' | 'low';
  related_evidence_ids: string[];
}

export interface InvestigationReport {
  investigation_id: string;
  summary: string;
  confidence_score: number;
  contradictions: Contradiction[];
  gaps: Gap[];
  questions: InvestigationQuestion[];
  key_findings: string[];
  generated_at: string;
}

export interface SceneObject {
  id: string;
  label: string;
  object_type: string;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  confidence: number;
  evidence_ids: string[];
}

export interface SceneData {
  investigation_id: string;
  objects: SceneObject[];
  room_dimensions?: { width: number; height: number };
  generated_at: string;
}

export interface UploadSession {
  session_id: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  progress: number;
  stage: string;
}

export type ActiveView = 'dashboard' | 'evidence' | 'timeline' | 'scene' | 'investigation';

// ── Cross-component selection state ─────────────────────────
// Shared across Evidence, Timeline, and Scene so selecting an
// item in one panel highlights its counterpart in the others.
export interface SceneSelection {
  /** Scene object ID currently selected (null = none) */
  sceneObjectId: string | null;
  /** Evidence item IDs driving the highlight (from timeline or evidence panel) */
  highlightedEvidenceIds: string[];
  /** Timeline event ID that triggered the current highlight */
  highlightedEventId: string | null;
}

export interface AppState {
  session?: UploadSession;
  evidenceCollection?: EvidenceCollection;
  timeline?: TimelineData;
  investigation?: InvestigationReport;
  scene?: SceneData;
  sceneLoading: boolean;
  sceneError?: string;
  activeView: ActiveView;
  isLoading: boolean;
  error?: string;
  // Cross-component selection
  selection: SceneSelection;
}
