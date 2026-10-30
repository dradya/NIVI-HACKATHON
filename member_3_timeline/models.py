"""
Evidence-Supported Sequence of Events (ESSE) Core Domain Models.
Defines structures for entities, events, temporal intervals, evidence links, and observation states.
"""

from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel, Field
import datetime


class EpistemicStatus(str, Enum):
    """
    Epistemic status of an event or relation:
    - OBSERVED: Directly recorded by evidence (logs, timestamps, video, signed record).
    - INFERRED: Deduced via temporal reasoning, causality, Allen's interval algebra, or LLM deduction.
    - UNKNOWN: Ambiguous, missing timestamps, or contradictory evidence with insufficient confidence.
    """
    OBSERVED = "OBSERVED"
    INFERRED = "INFERRED"
    UNKNOWN = "UNKNOWN"


class EntityType(str, Enum):
    PERSON = "PERSON"
    OBJECT = "OBJECT"
    LOCATION = "LOCATION"
    SYSTEM = "SYSTEM"
    ORGANIZATION = "ORGANIZATION"


class RelationType(str, Enum):
    OPERATED = "OPERATED"
    ACCESSED = "ACCESSED"
    TRANSFERRED_TO = "TRANSFERRED_TO"
    LOCATED_AT = "LOCATED_AT"
    ASSOCIATED_WITH = "ASSOCIATED_WITH"
    COMMUNICATED_WITH = "COMMUNICATED_WITH"
    MODIFIED = "MODIFIED"
    CARRIED = "CARRIED"


class EvidenceReference(BaseModel):
    """Direct ground-truth reference linking events to their original source data."""
    source_id: str = Field(description="Unique identifier of source (e.g., 'DOC_01', 'CCTV_LOG', 'EMAIL_THREAD')")
    source_type: str = Field(description="Type of source e.g. document, cctv, badge_reader, sensor")
    snippet: str = Field(description="Verbatim excerpt or log entry demonstrating the fact")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Reliability score of source")
    recorded_at: Optional[datetime.datetime] = Field(default=None, description="When the evidence artifact was logged")


class Entity(BaseModel):
    """Person, Object, or Location node involved in events."""
    id: str
    name: str
    entity_type: EntityType
    attributes: Dict[str, Any] = Field(default_factory=dict)


class EntityRelation(BaseModel):
    """Interpersonal or Person-Object relationship."""
    source_entity_id: str
    target_entity_id: str
    relation_type: RelationType
    status: EpistemicStatus = EpistemicStatus.OBSERVED
    evidence: List[EvidenceReference] = Field(default_factory=list)
    valid_from: Optional[datetime.datetime] = None
    valid_to: Optional[datetime.datetime] = None


class TemporalConstraintType(str, Enum):
    """Allen's Interval Algebra & point temporal relationships."""
    BEFORE = "BEFORE"               # A ends before B starts
    AFTER = "AFTER"                 # A starts after B ends
    MEETS = "MEETS"                 # A ends exactly when B starts
    OVERLAPS = "OVERLAPS"           # A starts before B, ends during B
    DURING = "DURING"               # A occurs entirely within B
    STARTS = "STARTS"               # A and B start together, A ends earlier
    FINISHES = "FINISHES"           # A ends with B, but started later
    EQUALS = "EQUALS"               # A and B coincide


class TemporalAnchor(BaseModel):
    """Point or Interval time representation."""
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    is_interval: bool = False
    is_approximate: bool = False
    relative_description: Optional[str] = None  # e.g., "10 minutes after login"


class Event(BaseModel):
    """Structured event node."""
    id: str
    title: str
    description: str
    status: EpistemicStatus = EpistemicStatus.OBSERVED
    temporal: TemporalAnchor = Field(default_factory=TemporalAnchor)
    participants: List[str] = Field(default_factory=list, description="Entity IDs involved")
    objects: List[str] = Field(default_factory=list, description="Object Entity IDs involved")
    evidence_ids: List[str] = Field(default_factory=list)
    evidence_items: List[EvidenceReference] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    inferred_reasoning: Optional[str] = None
    cluster_id: Optional[str] = None


class CrossSourceCorrelation(BaseModel):
    """Correlation link establishing identity or co-occurrence across diverse sources."""
    event_ids: List[str]
    correlation_type: str = Field(description="'EQUIVALENT', 'CAUSAL', 'SUB_EVENT', or 'CORROBORATING'")
    justification: str
    similarity_score: float
    epistemic_status: EpistemicStatus = EpistemicStatus.INFERRED
    evidence_links: List[EvidenceReference] = Field(default_factory=list)

