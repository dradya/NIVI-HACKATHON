import type { EvidenceCollection, TimelineData, InvestigationReport, SceneData } from '../types';

export const MOCK_EVIDENCE: EvidenceCollection = {
  investigation_id: 'INV-2024-WH-001',
  processed_at: '2024-11-15T04:12:00Z',
  total_count: 7,
  items: [
    {
      id: 'ev_001', type: 'video', source_file: 'cctv_entrance_02h30.mp4',
      timestamp: '2024-11-15T02:30:00Z', location: { x: 10, y: 0, z: 3.5 },
      confidence: 0.92, tags: ['cctv', 'entrance', 'vehicle'],
      description: 'CCTV footage of warehouse entrance — dark SUV parks at 02:31, two individuals exit wearing hoodies.',
      metadata: { duration_seconds: 180, resolution: '1080p', fps: 30 },
    },
    {
      id: 'ev_002', type: 'image', source_file: 'forensic_photo_door_lock.jpg',
      timestamp: '2024-11-15T02:34:00Z', location: { x: 10, y: 0, z: 1.1 },
      confidence: 0.88, tags: ['forced-entry', 'door', 'lock'],
      description: 'Rear entrance door — lock mechanism shows signs of forced entry. Scratch marks consistent with pick tool.',
      metadata: { camera: 'Canon EOS R5', iso: 800 },
    },
    {
      id: 'ev_003', type: 'sensor', source_file: 'motion_sensor_zone_b.log',
      timestamp: '2024-11-15T02:35:12Z', location: { x: 22, y: 14, z: 1.2 },
      confidence: 0.97, tags: ['motion', 'zone-b', 'sensor'],
      description: 'Motion sensor Zone B triggered at 02:35:12. Duration: 4 minutes 37 seconds.',
      metadata: { sensor_id: 'MS-B04', battery: '87%' },
    },
    {
      id: 'ev_004', type: 'document', source_file: 'inventory_manifest_q4.pdf',
      timestamp: '2024-11-14T17:00:00Z', location: { x: 0, y: 0 },
      confidence: 0.99, tags: ['inventory', 'manifest', 'pre-incident'],
      description: 'Q4 inventory manifest. Lists 48 server units in Bay C, valued at $2.3M.',
      extracted_text: 'INVENTORY MANIFEST — Q4 2024\nBay C: 48× Dell PowerEdge R750 @ $47,900\nTotal insured value: $2,299,200',
      metadata: { pages: 12, author: 'Operations Manager' },
    },
    {
      id: 'ev_005', type: 'image', source_file: 'bay_c_post_incident.jpg',
      timestamp: '2024-11-15T06:20:00Z', location: { x: 22, y: 14 },
      confidence: 0.95, tags: ['bay-c', 'post-incident'],
      description: 'Bay C photographed at 06:20 by first responding officer. 31 server units missing.',
      metadata: { camera: 'iPhone 15 Pro', officer_id: 'OFF-4421' },
    },
    {
      id: 'ev_006', type: 'video', source_file: 'cctv_bay_c_02h40.mp4',
      timestamp: '2024-11-15T02:40:00Z', location: { x: 22, y: 14, z: 3.2 },
      confidence: 0.61, tags: ['cctv', 'bay-c', 'degraded'],
      description: 'CCTV Bay C — footage degraded (lens occluded at 02:38). Partial silhouettes visible loading items.',
      metadata: { duration_seconds: 420, quality_score: 0.31, obstruction: 'spray-paint' },
    },
    {
      id: 'ev_007', type: 'sensor', source_file: 'alarm_system_log.json',
      timestamp: '2024-11-15T02:36:00Z', location: { x: 5, y: 8 },
      confidence: 0.99, tags: ['alarm', 'disabled', 'system'],
      description: 'Alarm panel log: system disarmed at 02:34:58 using valid 6-digit code. Re-armed at 03:21:44.',
      metadata: { code_attempts: 1, user_id: 'PIN_UNKNOWN' },
    },
  ],
};

export const MOCK_TIMELINE: TimelineData = {
  investigation_id: 'INV-2024-WH-001',
  start_time: '2024-11-15T02:30:00Z',
  end_time: '2024-11-15T06:20:00Z',
  generated_at: '2024-11-15T07:00:00Z',
  events: [
    { id: 'te_001', timestamp: '2024-11-15T02:30:00Z', description: 'Dark SUV arrives at warehouse entrance. Two occupants on CCTV.', evidence_ids: ['ev_001'], entities: ['Vehicle-SUV', 'Person-A', 'Person-B'], confidence: 0.92, event_type: 'primary', location: { x: 10, y: 0 } },
    { id: 'te_002', timestamp: '2024-11-15T02:34:00Z', description: 'Rear door lock forced open. Entry gained to warehouse.', evidence_ids: ['ev_002'], entities: ['Person-A', 'Person-B'], confidence: 0.88, event_type: 'primary', location: { x: 10, y: 0 } },
    { id: 'te_003', timestamp: '2024-11-15T02:34:58Z', description: 'Alarm disarmed with valid PIN — single attempt. Insider knowledge suspected.', evidence_ids: ['ev_007'], entities: ['Person-A'], confidence: 0.99, event_type: 'primary', location: { x: 5, y: 8 } },
    { id: 'te_004', timestamp: '2024-11-15T02:35:12Z', description: 'Motion sensor Zone B activated. Transit through Bay C corridor.', evidence_ids: ['ev_003'], entities: ['Person-A', 'Person-B'], confidence: 0.97, event_type: 'secondary', location: { x: 22, y: 14 } },
    { id: 'te_005', timestamp: '2024-11-15T02:38:00Z', description: 'Bay C CCTV occluded with spray-paint. Suggests pre-planned operation.', evidence_ids: ['ev_006'], entities: ['Person-A'], confidence: 0.75, event_type: 'primary', location: { x: 22, y: 14 } },
    { id: 'te_006', timestamp: '2024-11-15T02:40:00Z', duration_seconds: 2484, description: 'Loading operation. Estimated 31 server units transferred to vehicle.', evidence_ids: ['ev_005', 'ev_006'], entities: ['Person-A', 'Person-B', 'Vehicle-SUV'], confidence: 0.61, event_type: 'inferred', location: { x: 22, y: 14 } },
    { id: 'te_007', timestamp: '2024-11-15T03:21:44Z', description: 'Alarm re-armed. Perpetrators depart. Deliberate cover of tracks.', evidence_ids: ['ev_007'], entities: ['Person-A'], confidence: 0.99, event_type: 'primary', location: { x: 5, y: 8 } },
  ],
};

export const MOCK_INVESTIGATION: InvestigationReport = {
  investigation_id: 'INV-2024-WH-001',
  summary: 'Analysis indicates a highly coordinated insider-assisted theft. Perpetrators demonstrated advance knowledge of the alarm PIN, Bay C inventory layout, and CCTV camera positions. The 51-minute operation removed 31 server units worth approximately $1.48M. Systematic disabling of surveillance and precise target selection points to an organised operation with an internal source.',
  confidence_score: 0.84,
  generated_at: '2024-11-15T07:00:00Z',
  key_findings: [
    'Alarm disabled using a valid, single-attempt PIN — no brute-force recorded.',
    'Only Bay C targeted; 47 other bays and adjacent high-value electronics untouched.',
    'Bay C CCTV occluded before loading began — perpetrators knew the camera position.',
    '31 of 48 server units removed — limit likely vehicle capacity, not time.',
    'Alarm re-armed on exit, delaying detection by approximately 2.5 hours.',
  ],
  contradictions: [
    { id: 'con_001', evidence_ids: ['ev_001', 'ev_006'], description: 'Entrance CCTV shows two individuals; degraded Bay C footage suggests a possible third person assisting with loading.', severity: 'moderate' },
    { id: 'con_002', evidence_ids: ['ev_003', 'ev_006'], description: 'Motion sensor active only 4m 37s, yet loading 31 servers would require ~40 minutes. Sensor data gap unexplained.', severity: 'critical' },
  ],
  gaps: [
    { id: 'gap_001', timerange: { start: '2024-11-15T02:38:00Z', end: '2024-11-15T03:21:44Z' }, description: 'No visual coverage of Bay C during the 43-minute loading window.', suggested_evidence_types: ['video', 'sensor'] },
    { id: 'gap_002', description: 'PIN code user attribution unknown — access control logs required from building management.', suggested_evidence_types: ['document'] },
  ],
  questions: [
    { id: 'q_001', question: 'Who had authorised access to the alarm PIN at the time of the incident?', priority: 'high', related_evidence_ids: ['ev_007'] },
    { id: 'q_002', question: 'Are there additional CCTV cameras on the loading dock or rear car park?', priority: 'high', related_evidence_ids: ['ev_001', 'ev_006'] },
    { id: 'q_003', question: 'Why does the motion sensor show only 4m 37s of activity for an operation that likely took ~40 minutes?', priority: 'high', related_evidence_ids: ['ev_003'] },
    { id: 'q_004', question: 'Were any employee badge-swipes recorded between 22:00 and 06:00?', priority: 'medium', related_evidence_ids: [] },
  ],
};

export const MOCK_SCENE: SceneData = {
  investigation_id: 'INV-2024-WH-001',
  generated_at: '2024-11-15T07:00:00Z',
  room_dimensions: { width: 60, height: 40 },
  objects: [
    { id: 'obj_001', label: 'Front Entrance', object_type: 'door', position: { x: 0, y: 20 }, dimensions: { width: 4, height: 3 }, confidence: 0.99, evidence_ids: [] },
    { id: 'obj_002', label: 'Rear Door (Forced)', object_type: 'door', position: { x: 10, y: 0 }, dimensions: { width: 2, height: 2.5 }, confidence: 0.95, evidence_ids: ['ev_002'] },
    { id: 'obj_003', label: 'Bay C — Server Racks', object_type: 'inventory', position: { x: 22, y: 14 }, dimensions: { width: 12, height: 8 }, confidence: 0.99, evidence_ids: ['ev_004', 'ev_005'] },
    { id: 'obj_004', label: 'CCTV Entrance', object_type: 'camera', position: { x: 10, y: 1 }, dimensions: { width: 1.2, height: 1.2 }, confidence: 0.99, evidence_ids: ['ev_001'] },
    { id: 'obj_005', label: 'CCTV Bay C (Occluded)', object_type: 'camera', position: { x: 22, y: 15 }, dimensions: { width: 1.2, height: 1.2 }, confidence: 0.95, evidence_ids: ['ev_006'] },
    { id: 'obj_006', label: 'Motion Sensor B', object_type: 'sensor', position: { x: 18, y: 10 }, dimensions: { width: 1.5, height: 1.5 }, confidence: 0.97, evidence_ids: ['ev_003'] },
    { id: 'obj_007', label: 'Alarm Panel', object_type: 'sensor', position: { x: 5, y: 8 }, dimensions: { width: 1.5, height: 2 }, confidence: 0.99, evidence_ids: ['ev_007'] },
    { id: 'obj_008', label: 'Suspect Vehicle', object_type: 'vehicle', position: { x: 10, y: -3 }, dimensions: { width: 2.5, height: 5 }, confidence: 0.92, evidence_ids: ['ev_001'] },
  ],
};
