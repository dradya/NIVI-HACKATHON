"""
Investigation Analytics Engine
Modules:
1. Detect missing evidence intervals (timeline gap detection)
2. Identify conflicting claims (contradiction detection)
3. Associate people with evidence and events (entity-event graph)
4. Calculate evidence relevance scores (weighted scoring)
5. Generate investigation questions and structured reports
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
import json


@dataclass
class EvidenceItem:
    evidence_id: str
    description: str
    source: str
    timestamp: datetime
    end_timestamp: Optional[datetime] = None
    reliability: float = 1.0  # 0.0 to 1.0
    directness: float = 1.0   # Direct evidence vs circumstantial
    tags: List[str] = field(default_factory=list)
    people_involved: List[str] = field(default_factory=list)


@dataclass
class Claim:
    claim_id: str
    person: str
    topic: str
    statement: str
    claimed_value: Any
    timestamp: datetime
    supporting_evidence_ids: List[str] = field(default_factory=list)


@dataclass
class Event:
    event_id: str
    title: str
    start_time: datetime
    end_time: datetime
    location: str
    involved_people: List[str] = field(default_factory=list)
    linked_evidence_ids: List[str] = field(default_factory=list)


class InvestigationEngine:
    def __init__(self):
        self.evidence: Dict[str, EvidenceItem] = {}
        self.claims: Dict[str, Claim] = {}
        self.events: Dict[str, Event] = {}

    def add_evidence(self, item: EvidenceItem):
        self.evidence[item.evidence_id] = item

    def add_claim(self, claim: Claim):
        self.claims[claim.claim_id] = claim

    def add_event(self, event: Event):
        self.events[event.event_id] = event

    # ---------------------------------------------------------
    # 1. Detect Missing Evidence Intervals
    # ---------------------------------------------------------
    def detect_missing_evidence_intervals(
        self,
        start_time: datetime,
        end_time: datetime,
        max_allowed_gap: timedelta = timedelta(hours=1),
        target_tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Identifies time intervals within [start_time, end_time] where no evidence exists
        or the gap exceeds max_allowed_gap.
        """
        filtered_evidence = list(self.evidence.values())
        if target_tags:
            filtered_evidence = [
                e for e in filtered_evidence if any(t in e.tags for t in target_tags)
            ]

        # Extract all covered intervals
        intervals = []
        for e in filtered_evidence:
            e_start = max(start_time, e.timestamp)
            e_end = min(end_time, e.end_timestamp if e.end_timestamp else e.timestamp)
            if e_start <= end_time and e_end >= start_time:
                intervals.append((e_start, e_end))

        if not intervals:
            return [{
                "gap_start": start_time.isoformat(),
                "gap_end": end_time.isoformat(),
                "duration_minutes": (end_time - start_time).total_seconds() / 60.0,
                "severity": "CRITICAL"
            }]

        # Merge overlapping intervals
        intervals.sort(key=lambda x: x[0])
        merged = [intervals[0]]
        for cur_start, cur_end in intervals[1:]:
            last_start, last_end = merged[-1]
            if cur_start <= last_end:
                merged[-1] = (last_start, max(last_end, cur_end))
            else:
                merged.append((cur_start, cur_end))

        # Identify gaps exceeding threshold
        gaps = []
        pointer = start_time
        for seg_start, seg_end in merged:
            if seg_start > pointer and (seg_start - pointer) >= max_allowed_gap:
                gaps.append({
                    "gap_start": pointer.isoformat(),
                    "gap_end": seg_start.isoformat(),
                    "duration_minutes": (seg_start - pointer).total_seconds() / 60.0,
                    "severity": "HIGH" if (seg_start - pointer) > 2 * max_allowed_gap else "MEDIUM"
                })
            pointer = max(pointer, seg_end)

        if pointer < end_time and (end_time - pointer) >= max_allowed_gap:
            gaps.append({
                "gap_start": pointer.isoformat(),
                "gap_end": end_time.isoformat(),
                "duration_minutes": (end_time - pointer).total_seconds() / 60.0,
                "severity": "HIGH" if (end_time - pointer) > 2 * max_allowed_gap else "MEDIUM"
            })

        return gaps

    # ---------------------------------------------------------
    # 2. Identify Conflicting Claims
    # ---------------------------------------------------------
    def identify_conflicting_claims(self) -> List[Dict[str, Any]]:
        """
        Detects contradictions where claims on the same topic propose incompatible values
        or statements between individuals.
        """
        by_topic: Dict[str, List[Claim]] = {}
        for c in self.claims.values():
            by_topic.setdefault(c.topic.strip().lower(), []).append(c)

        conflicts = []
        for topic, claims_list in by_topic.items():
            n = len(claims_list)
            for i in range(n):
                for j in range(i + 1, n):
                    c1, c2 = claims_list[i], claims_list[j]
                    if c1.person != c2.person and c1.claimed_value != c2.claimed_value:
                        conflicts.append({
                            "topic": topic,
                            "party_a": {
                                "claim_id": c1.claim_id,
                                "person": c1.person,
                                "statement": c1.statement,
                                "value": c1.claimed_value
                            },
                            "party_b": {
                                "claim_id": c2.claim_id,
                                "person": c2.person,
                                "statement": c2.statement,
                                "value": c2.claimed_value
                            },
                            "conflict_nature": "Value mismatch across subjects"
                        })
        return conflicts

    # ---------------------------------------------------------
    # 3. Associate People with Evidence and Events
    # ---------------------------------------------------------
    def associate_people_network(self) -> Dict[str, Any]:
        """
        Builds an associative index linking people to specific evidence, events, and co-occurrences.
        """
        people_map: Dict[str, Dict[str, Any]] = {}

        def init_person(p: str):
            if p not in people_map:
                people_map[p] = {
                    "linked_evidence": [],
                    "linked_events": [],
                    "co_occurrences": set(),
                    "claims_made": []
                }

        # Associate with Evidence
        for eid, ev in self.evidence.items():
            for p in ev.people_involved:
                init_person(p)
                people_map[p]["linked_evidence"].append(eid)
            # pairwise co-occurrence
            for i, p1 in enumerate(ev.people_involved):
                for p2 in ev.people_involved[i+1:]:
                    people_map[p1]["co_occurrences"].add(p2)
                    people_map[p2]["co_occurrences"].add(p1)

        # Associate with Events
        for ev_id, event in self.events.items():
            for p in event.involved_people:
                init_person(p)
                people_map[p]["linked_events"].append(ev_id)
            for i, p1 in enumerate(event.involved_people):
                for p2 in event.involved_people[i+1:]:
                    people_map[p1]["co_occurrences"].add(p2)
                    people_map[p2]["co_occurrences"].add(p1)

        # Associate with Claims
        for cid, claim in self.claims.items():
            init_person(claim.person)
            people_map[claim.person]["claims_made"].append(cid)

        # Format for output
        result = {}
        for person, data in people_map.items():
            result[person] = {
                "linked_evidence_count": len(data["linked_evidence"]),
                "evidence_ids": data["linked_evidence"],
                "linked_events_count": len(data["linked_events"]),
                "event_ids": data["linked_events"],
                "claims_count": len(data["claims_made"]),
                "claims_ids": data["claims_made"],
                "frequent_associates": sorted(list(data["co_occurrences"]))
            }
        return result

    # ---------------------------------------------------------
    # 4. Calculate Evidence Relevance Scores
    # ---------------------------------------------------------
    def calculate_evidence_relevance(
        self,
        investigation_query_keywords: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Scores evidence items based on:
        - keyword topical match (0.4)
        - source reliability (0.3)
        - directness/weight (0.2)
        - temporal proximity / association density (0.1)
        """
        keywords_lower = [k.lower() for k in investigation_query_keywords]
        scored_list = []

        for eid, item in self.evidence.items():
            # Keyword matching score
            text_corpus = f"{item.description} {' '.join(item.tags)} {item.source}".lower()
            matches = sum(1 for kw in keywords_lower if kw in text_corpus)
            kw_score = min(1.0, matches / max(1, len(keywords_lower)))

            # Association density score
            assoc_score = min(1.0, len(item.people_involved) * 0.3)

            # Combined weighted score
            final_score = (
                (0.40 * kw_score) +
                (0.30 * item.reliability) +
                (0.20 * item.directness) +
                (0.10 * assoc_score)
            )

            scored_list.append({
                "evidence_id": eid,
                "description": item.description,
                "relevance_score": round(final_score, 4),
                "breakdown": {
                    "keyword_match": round(kw_score, 2),
                    "reliability": round(item.reliability, 2),
                    "directness": round(item.directness, 2),
                    "association_density": round(assoc_score, 2)
                }
            })

        scored_list.sort(key=lambda x: x["relevance_score"], reverse=True)
        return scored_list

    # ---------------------------------------------------------
    # 5. Generate Investigation Questions and Reports
    # ---------------------------------------------------------
    def generate_investigation_report(
        self,
        timeline_start: datetime,
        timeline_end: datetime,
        investigation_topic_keywords: List[str]
    ) -> Dict[str, Any]:
        """
        Compiles the entire state into a structured report with AI/heuristic
        inquiry questions to drive next investigative actions.
        """
        gaps = self.detect_missing_evidence_intervals(timeline_start, timeline_end)
        conflicts = self.identify_conflicting_claims()
        network = self.associate_people_network()
        relevance = self.calculate_evidence_relevance(investigation_topic_keywords)

        questions = []

        # Questions from gaps
        for g in gaps:
            questions.append({
                "type": "TIMELINE_GAP",
                "question": f"What occurred between {g['gap_start']} and {g['gap_end']}? Are there surveillance, badge logs, or witness statements covering this {g['duration_minutes']:.0f}-minute gap?",
                "priority": g["severity"]
            })

        # Questions from conflicts
        for c in conflicts:
            questions.append({
                "type": "CONTRADICTION",
                "question": f"Contradiction on '{c['topic']}': {c['party_a']['person']} stated '{c['party_a']['statement']}', while {c['party_b']['person']} stated '{c['party_b']['statement']}'. What independent digital or physical corroboration exists?",
                "priority": "CRITICAL"
            })

        # Questions from key figures
        for person, data in network.items():
            if len(data["frequent_associates"]) > 1 and data["claims_count"] == 0:
                questions.append({
                    "type": "UNINTERVIEWED_PERSON",
                    "question": f"{person} is linked to {data['linked_evidence_count']} piece(s) of evidence and has frequent contact with {', '.join(data['frequent_associates'])}, but has no registered statements. Has an interview been conducted?",
                    "priority": "HIGH"
                })

        report = {
            "generated_at": datetime.now().isoformat(),
            "executive_summary": {
                "total_evidence_pieces": len(self.evidence),
                "total_claims": len(self.claims),
                "total_events": len(self.events),
                "unresolved_contradictions": len(conflicts),
                "timeline_gaps_identified": len(gaps),
                "tracked_persons_count": len(network)
            },
            "timeline_gaps": gaps,
            "conflicting_claims": conflicts,
            "people_evidence_associations": network,
            "top_relevant_evidence": relevance[:5],
            "targeted_investigation_questions": questions
        }
        return report


if __name__ == "__main__":
    engine = InvestigationEngine()

    # Sample Evidence
    engine.add_evidence(EvidenceItem(
        evidence_id="EV-101",
        description="Keycard access log for server room",
        source="Access Control Database",
        timestamp=datetime(2026, 10, 30, 14, 0),
        end_timestamp=datetime(2026, 10, 30, 14, 5),
        reliability=0.95,
        directness=1.0,
        tags=["access_log", "server_room"],
        people_involved=["Alice Smith"]
    ))

    engine.add_evidence(EvidenceItem(
        evidence_id="EV-102",
        description="Hallway CCTV footage showing movement",
        source="CCTV Archive",
        timestamp=datetime(2026, 10, 30, 16, 0),
        end_timestamp=datetime(2026, 10, 30, 16, 30),
        reliability=0.85,
        directness=0.8,
        tags=["cctv", "hallway"],
        people_involved=["Alice Smith", "Bob Jones"]
    ))

    # Sample Claims
    engine.add_claim(Claim(
        claim_id="CLM-01",
        person="Alice Smith",
        topic="server_room_presence",
        statement="I was never in the server room after 13:00.",
        claimed_value=False,
        timestamp=datetime(2026, 10, 30, 17, 0)
    ))

    engine.add_claim(Claim(
        claim_id="CLM-02",
        person="Bob Jones",
        topic="server_room_presence",
        statement="I saw Alice entering the server room around 14:00.",
        claimed_value=True,
        timestamp=datetime(2026, 10, 30, 17, 30)
    ))

    # Sample Events
    engine.add_event(Event(
        event_id="EVT-01",
        title="Unauthorized Data Exfiltration",
        start_time=datetime(2026, 10, 30, 14, 10),
        end_time=datetime(2026, 10, 30, 14, 45),
        location="Server Room 3B",
        involved_people=["Alice Smith"]
    ))

    # Generate Investigation Report
    report = engine.generate_investigation_report(
        timeline_start=datetime(2026, 10, 30, 13, 0),
        timeline_end=datetime(2026, 10, 30, 17, 0),
        investigation_topic_keywords=["server", "access", "exfiltration"]
    )

    print(json.dumps(report, indent=2))

