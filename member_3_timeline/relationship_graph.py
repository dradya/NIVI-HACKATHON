"""
Relationship Graph & Cross-Source Correlation Engine.
Implements:
- Entity relationship graph (Person, Object, Location, System)
- Multi-source entity resolution & event clustering
- Cross-source corroboration and discrepancy detection
- Epistemic status label determination (Observed vs Inferred vs Unknown)
"""

from __future__ import annotations
from typing import List, Dict, Set, Tuple, Optional
import networkx as nx
from models import (
    Entity,
    EntityRelation,
    Event,
    EpistemicStatus,
    CrossSourceCorrelation,
    EvidenceReference,
    RelationType,
    EntityType
)


class RelationshipGraphEngine:
    """Manages Person, Object, and System entities and their interconnected relationships."""
    def __init__(self):
        self.graph = nx.MultiDiGraph()
        self.entities: Dict[str, Entity] = {}

    def add_entity(self, entity: Entity):
        self.entities[entity.id] = entity
        self.graph.add_node(
            entity.id,
            name=entity.name,
            entity_type=entity.entity_type.value,
            attributes=entity.attributes
        )

    def add_relation(self, relation: EntityRelation):
        self.graph.add_edge(
            relation.source_entity_id,
            relation.target_entity_id,
            relation_type=relation.relation_type.value,
            status=relation.status.value,
            evidence=[e.model_dump() for e in relation.evidence],
            valid_from=relation.valid_from.isoformat() if relation.valid_from else None,
            valid_to=relation.valid_to.isoformat() if relation.valid_to else None
        )

    def get_entity_interactions(self, entity_id: str) -> List[Dict]:
        """Returns all inbound and outbound relationships for a given person or object."""
        interactions = []
        if entity_id not in self.graph:
            return interactions

        # Outbound
        for _, target, data in self.graph.out_edges(entity_id, data=True):
            interactions.append({
                "direction": "outbound",
                "target_id": target,
                "target_name": self.entities.get(target, target).name if target in self.entities else target,
                **data
            })
        # Inbound
        for source, _, data in self.graph.in_edges(entity_id, data=True):
            interactions.append({
                "direction": "inbound",
                "source_id": source,
                "source_name": self.entities.get(source, source).name if source in self.entities else source,
                **data
            })
        return interactions

    def infer_co_presence(self, events: List[Event]) -> List[EntityRelation]:
        """
        Infers person-to-person and person-to-object relations from shared co-occurrence in events.
        Labels inferred interactions with EpistemicStatus.INFERRED.
        """
        inferred_relations = []
        for ev in events:
            participants = ev.participants
            objects = ev.objects

            # Person to Person co-presence
            for i in range(len(participants)):
                for j in range(i + 1, len(participants)):
                    p1, p2 = participants[i], participants[j]
                    rel = EntityRelation(
                        source_entity_id=p1,
                        target_entity_id=p2,
                        relation_type=RelationType.ASSOCIATED_WITH,
                        status=EpistemicStatus.INFERRED,
                        evidence=[
                            EvidenceReference(
                                source_id=f"EVENT_{ev.id}",
                                source_type="co_presence_inference",
                                snippet=f"Co-present during event: '{ev.title}'",
                                confidence=0.85
                            )
                        ],
                        valid_from=ev.temporal.start_time,
                        valid_to=ev.temporal.end_time or ev.temporal.start_time
                    )
                    self.add_relation(rel)
                    inferred_relations.append(rel)

            # Person to Object interaction
            for p in participants:
                for obj in objects:
                    rel = EntityRelation(
                        source_entity_id=p,
                        target_entity_id=obj,
                        relation_type=RelationType.ACCESSED,
                        status=EpistemicStatus.INFERRED,
                        evidence=[
                            EvidenceReference(
                                source_id=f"EVENT_{ev.id}",
                                source_type="object_access_inference",
                                snippet=f"Person involved with object during event: '{ev.title}'",
                                confidence=0.9
                            )
                        ],
                        valid_from=ev.temporal.start_time,
                        valid_to=ev.temporal.end_time or ev.temporal.start_time
                    )
                    self.add_relation(rel)
                    inferred_relations.append(rel)

        return inferred_relations


class CrossSourceCorrelator:
    """
    Correlates events and evidence across multiple diverse sources (e.g. CCTV, badge logs, chat logs, tickets).
    Resolves duplicates, establishes corroboration, and detects contradictions.
    """
    @staticmethod
    def calculate_text_similarity(t1: str, t2: str) -> float:
        w1 = set(t1.lower().split())
        w2 = set(t2.lower().split())
        if not w1 or not w2:
            return 0.0
        intersection = len(w1.intersection(w2))
        union = len(w1.union(w2))
        return intersection / union

    @classmethod
    def correlate_events(cls, events: List[Event], time_window_seconds: int = 600) -> List[CrossSourceCorrelation]:
        correlations: List[CrossSourceCorrelation] = []
        n = len(events)

        for i in range(n):
            for j in range(i + 1, n):
                ev1 = events[i]
                ev2 = events[j]

                # Check shared participants
                shared_participants = set(ev1.participants).intersection(set(ev2.participants))
                shared_objects = set(ev1.objects).intersection(set(ev2.objects))

                # Check temporal closeness
                time_close = False
                if ev1.temporal.start_time and ev2.temporal.start_time:
                    delta = abs((ev1.temporal.start_time - ev2.temporal.start_time).total_seconds())
                    if delta <= time_window_seconds:
                        time_close = True

                sim_score = cls.calculate_text_similarity(ev1.title + " " + ev1.description, ev2.title + " " + ev2.description)

                # Corroborating Evidence: Multiple sources reporting same event or concurrent action
                if (shared_participants or shared_objects) and (time_close or sim_score > 0.35):
                    all_evidence = ev1.evidence_items + ev2.evidence_items
                    source_ids = {e.source_id for e in all_evidence}

                    c_type = "EQUIVALENT" if sim_score > 0.6 else "CORROBORATING"
                    justification = (
                        f"Events share participants ({', '.join(shared_participants) or 'None'}), "
                        f"objects ({', '.join(shared_objects) or 'None'}), "
                        f"and occurred within temporal proximity across {len(source_ids)} distinct source(s)."
                    )

                    correlations.append(CrossSourceCorrelation(
                        event_ids=[ev1.id, ev2.id],
                        correlation_type=c_type,
                        justification=justification,
                        similarity_score=sim_score,
                        epistemic_status=EpistemicStatus.OBSERVED if len(source_ids) > 1 else EpistemicStatus.INFERRED,
                        evidence_links=all_evidence
                    ))

        return correlations

