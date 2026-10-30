"""
Integration and End-to-End Test Suite for Evidence-Supported Sequence of Events Pipeline.
Demonstrates:
- Multi-source event extraction (CCTV log, Security Door Swipe, Bastion Terminal Log, Chat Transcript)
- Observed vs. Inferred vs. Unknown classifications
- Person & Object relationship inference
- Cross-source corroboration
- Topological temporal reasoning and timeline generation
"""

import datetime
from models import EntityType, EpistemicStatus, TemporalConstraintType
from pipeline import EvidenceTimelinePipeline


def run_demonstration():
    print("=" * 70)
    print("[INIT] Initializing Evidence-Supported Sequence of Events (ESSE) System")
    print("=" * 70)

    pipeline = EvidenceTimelinePipeline()

    # 1. Register Person and Object Entities
    p_alice = pipeline.register_entity("P_ALICE", "Alice Chen", EntityType.PERSON, {"role": "Lead DevOps Engineer"})
    p_bob = pipeline.register_entity("P_BOB", "Bob Martin", EntityType.PERSON, {"role": "Security Analyst"})
    p_charlie = pipeline.register_entity("P_CHARLIE", "Charlie Zhao", EntityType.PERSON, {"role": "Database Admin"})

    obj_server = pipeline.register_entity("OBJ_SERVER_01", "Production Database Vault", EntityType.OBJECT, {"criticality": "HIGH"})
    obj_keycard = pipeline.register_entity("OBJ_KEYCARD_09", "Master Keycard #09", EntityType.OBJECT)
    obj_terminal = pipeline.register_entity("OBJ_BASTION", "Bastion Terminal #4", EntityType.OBJECT)

    print(f" Registered {len(pipeline.entities)} entities (Persons & Objects).")

    # 2. Ingest Multi-Source Evidence
    cctv_feed = """
    2026-10-30 14:15:00 CCTV Camera 3 captures Alice Chen entering Server Room vestibule.
    2026-10-30 14:18:30 CCTV Camera 3 captures Bob Martin meeting Alice Chen at the secure door.
    2026-10-30 14:35:00 CCTV shows Alice Chen leaving the corridor holding Master Keycard #09.
    """

    badge_reader = """
    2026-10-30 14:15:45 Badge Reader DR-01: Master Keycard #09 swiped by Alice Chen. Access granted.
    2026-10-30 14:19:10 Badge Reader DR-01: Door held open, Bob Martin enters alongside.
    """

    terminal_logs = """
    2026-10-30 14:22:00 Bastion Terminal #4 session initiated by Alice Chen.
    2026-10-30 14:28:15 Production Database Vault schema snapshot exported to encrypted USB drive.
    2026-10-30 14:32:00 Bastion Terminal #4 session terminated.
    """

    # Unanchored / ambiguous notes representing INFERRED & UNKNOWN events
    informal_witness_report = """
    Around the time of database backup, presumably Bob Martin and Alice Chen discussed emergency migration.
    Someone unspecified attempted an unauthorized remote query on Production Database Vault.
    """

    print(" Ingesting multi-source evidentiary feeds...")
    e_cctv = pipeline.ingest_source("SOURCE_CCTV_FEED", "CCTV Surveillance", cctv_feed)
    e_badge = pipeline.ingest_source("SOURCE_BADGE_LOGS", "RFID Access System", badge_reader)
    e_term = pipeline.ingest_source("SOURCE_BASTION_LOGS", "Audit Terminal Log", terminal_logs)
    e_witness = pipeline.ingest_source("SOURCE_WITNESS_MEMO", "Internal Witness Note", informal_witness_report)

    total_events = len(pipeline.events)
    print(f" Extracted {total_events} raw events from 4 disparate sources.")

    # 3. Add Temporal Constraints
    pipeline.add_temporal_constraint(e_term[0].id, e_witness[0].id, TemporalConstraintType.BEFORE)
    pipeline.add_temporal_constraint(e_witness[0].id, e_term[2].id, TemporalConstraintType.BEFORE)

    # 4. Execute the reasoning engine pipeline
    print("\n[RUN] Executing Temporal Reasoning Engine & Graph Correlation...")
    ordered_events, correlations, inferred_relations = pipeline.run_pipeline()

    # 5. Summarize Pipeline Output
    print("\n" + "=" * 70)
    print("[RESULT] CHRONOLOGICALLY RECONSTRUCTED TIMELINE WITH EVIDENCE LINKING")
    print("=" * 70)

    for i, ev in enumerate(ordered_events, 1):
        status_tag = f"[{ev.status.value}]"
        time_display = ev.temporal.start_time.strftime("%H:%M:%S") if ev.temporal.start_time else "UNKNOWN TIME"
        print(f"{i:2d}. {status_tag:<11} {time_display} | {ev.title}")
        if ev.participants:
            print(f"    Participants: {', '.join(ev.participants)}")
        if ev.objects:
            print(f"    Objects:      {', '.join(ev.objects)}")
        if ev.inferred_reasoning:
            print(f"    Reasoning:    [Reasoning] {ev.inferred_reasoning}")
        for ev_ref in ev.evidence_items:
            print(f"    Evidence:     [{ev_ref.source_id}] \"{ev_ref.snippet}\"")
        print()

    print("=" * 70)
    print("[CORRELATION] CROSS-SOURCE CORROBORATIONS DETECTED")
    print("=" * 70)
    for c in correlations:
        print(f"* Type: {c.correlation_type} | Events: {c.event_ids}")
        print(f"  Justification: {c.justification}\n")

    print("=" * 70)
    print("[RELATIONS] PERSON / OBJECT RELATIONSHIPS INFERRED")
    print("=" * 70)
    for rel in inferred_relations:
        print(f"* ({rel.source_entity_id}) ---[{rel.relation_type.value}]---> ({rel.target_entity_id}) | Status: {rel.status.value}")

    # Generate Markdown and HTML artifacts
    md_output = pipeline.export_timeline_markdown(ordered_events, correlations)
    with open("timeline_report.md", "w", encoding="utf-8") as f:
        f.write(md_output)

    html_output = pipeline.export_timeline_html(ordered_events)
    with open("timeline_report.html", "w", encoding="utf-8") as f:
        f.write(html_output)

    print("\n[SUCCESS] Successfully exported:")
    print("   - timeline_report.md")
    print("   - timeline_report.html")


if __name__ == "__main__":
    run_demonstration()
