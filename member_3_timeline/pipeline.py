"""
Unified Pipeline for Evidence-Supported Sequence of Events (ESSE).
Orchestrates:
- Raw multi-source ingestion
- Event extraction
- Temporal reasoning & DAG ordering
- Cross-source corroboration
- Epistemic status labeling (Observed / Inferred / Unknown)
- Person/object relationship graph synthesis
- Timeline generation
"""

from __future__ import annotations
import datetime
from typing import List, Dict, Optional, Tuple
from models import (
    Entity,
    EntityType,
    EntityRelation,
    Event,
    EpistemicStatus,
    CrossSourceCorrelation,
    TemporalConstraintType
)
from temporal_reasoning import TemporalGraphReasoningEngine
from relationship_graph import RelationshipGraphEngine, CrossSourceCorrelator
from event_extractor import EventExtractor
from timeline_generator import EvidenceLinkedTimelineGenerator


class EvidenceTimelinePipeline:
    def __init__(self):
        self.temporal_engine = TemporalGraphReasoningEngine()
        self.relationship_engine = RelationshipGraphEngine()
        self.correlator = CrossSourceCorrelator()
        self.entities: Dict[str, Entity] = {}
        self.events: Dict[str, Event] = {}

    def register_entity(self, entity_id: str, name: str, entity_type: EntityType, attributes: Optional[Dict] = None):
        entity = Entity(id=entity_id, name=name, entity_type=entity_type, attributes=attributes or {})
        self.entities[entity_id] = entity
        self.relationship_engine.add_entity(entity)
        return entity

    def ingest_source(self, source_id: str, source_type: str, content: str) -> List[Event]:
        extracted = EventExtractor.extract_from_raw_source(
            source_id=source_id,
            source_type=source_type,
            content=content,
            entities_catalog=self.entities
        )
        for ev in extracted:
            self.add_event(ev)
        return extracted

    def add_event(self, event: Event):
        self.events[event.id] = event
        self.temporal_engine.add_event(event)

    def add_temporal_constraint(self, from_event_id: str, to_event_id: str, constraint: TemporalConstraintType):
        self.temporal_engine.add_constraint(from_event_id, to_event_id, constraint)

    def run_pipeline(self) -> Tuple[List[Event], List[CrossSourceCorrelation], List[EntityRelation]]:
        """
        Executes end-to-end temporal reasoning, relationship inference,
        epistemic status resolution, and chronological sorting.
        """
        # 1. Infer person/object co-presence relationships
        events_list = list(self.events.values())
        inferred_relations = self.relationship_engine.infer_co_presence(events_list)

        # 2. Correlate cross-source events
        correlations = self.correlator.correlate_events(events_list)

        # 3. Add precedence constraints across correlated events
        for corr in correlations:
            if corr.correlation_type == "CORROBORATING" and len(corr.event_ids) == 2:
                # Corroborating events can align or link
                e1, e2 = corr.event_ids[0], corr.event_ids[1]
                t1 = self.events[e1].temporal.start_time
                t2 = self.events[e2].temporal.start_time
                if t1 and t2:
                    if t1 < t2:
                        self.temporal_engine.add_constraint(e1, e2, TemporalConstraintType.BEFORE)
                    elif t2 < t1:
                        self.temporal_engine.add_constraint(e2, e1, TemporalConstraintType.BEFORE)

        # 4. Compute definitive chronological ordering & infer unanchored/bounded event times
        ordered_events = self.temporal_engine.compute_chronological_ordering()

        return ordered_events, correlations, inferred_relations

    def export_timeline_markdown(self, ordered_events: List[Event], correlations: List[CrossSourceCorrelation]) -> str:
        generator = EvidenceLinkedTimelineGenerator(self.entities)
        return generator.generate_markdown_timeline(ordered_events, correlations)

    def export_timeline_html(self, ordered_events: List[Event]) -> str:
        generator = EvidenceLinkedTimelineGenerator(self.entities)
        return generator.generate_html_timeline_artifact(ordered_events)

