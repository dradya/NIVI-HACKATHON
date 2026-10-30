"""
Event Extractor using rule-based/regex extraction + LLM abstraction interface.
Extracts:
- Discrete events with temporal anchors
- Participants & objects
- Epistemic markers (explicit timestamp vs estimated vs ambiguous)
- Strict evidence attribution
"""

from __future__ import annotations
import re
import datetime
from typing import List, Dict, Any, Optional
from models import Event, Entity, EntityType, EpistemicStatus, TemporalAnchor, EvidenceReference


class EventExtractor:
    """
    Extracts events from raw unstructured or semi-structured multi-source data.
    Designed with an LLM prompt contract and deterministic fallback parsers.
    """
    ISO_DATE_REGEX = re.compile(r'(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})')
    TIME_REGEX = re.compile(r'\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b')

    @classmethod
    def parse_timestamp(cls, text: str, base_date: datetime.date = datetime.date(2026, 10, 30)) -> Optional[datetime.datetime]:
        iso_match = cls.ISO_DATE_REGEX.search(text)
        if iso_match:
            raw = iso_match.group(1).replace('T', ' ')
            try:
                return datetime.datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        time_match = cls.TIME_REGEX.search(text)
        if time_match:
            raw_time = time_match.group(1).strip()
            for fmt in ("%I:%M %p", "%I:%M:%S %p", "%H:%M:%S", "%H:%M"):
                try:
                    t = datetime.datetime.strptime(raw_time, fmt).time()
                    return datetime.datetime.combine(base_date, t)
                except ValueError:
                    continue
        return None

    @classmethod
    def extract_from_raw_source(
        cls,
        source_id: str,
        source_type: str,
        content: str,
        entities_catalog: Optional[Dict[str, Entity]] = None
    ) -> List[Event]:
        """
        Parses text, log lines, or transcripts into structured Event models with evidence attribution.
        """
        events: List[Event] = []
        lines = [line.strip() for line in content.splitlines() if line.strip()]

        for idx, line in enumerate(lines):
            timestamp = cls.parse_timestamp(line)

            # Determine epistemic status based on evidence clarity
            if timestamp is not None:
                status = EpistemicStatus.OBSERVED
            elif any(marker in line.lower() for marker in ["approx", "around", "likely", "probably", "presumably", "afterwards"]):
                status = EpistemicStatus.INFERRED
            else:
                status = EpistemicStatus.UNKNOWN

            # Identify participants and objects
            participants = []
            objects = []
            if entities_catalog:
                for eid, entity in entities_catalog.items():
                    if re.search(r'\b' + re.escape(entity.name) + r'\b', line, re.IGNORECASE):
                        if entity.entity_type == EntityType.PERSON:
                            participants.append(eid)
                        elif entity.entity_type in (EntityType.OBJECT, EntityType.SYSTEM):
                            objects.append(eid)

            event_id = f"EV_{source_id}_{idx+1:03d}"
            
            # Clean title from line
            clean_title = re.sub(cls.ISO_DATE_REGEX, '', line)
            clean_title = re.sub(cls.TIME_REGEX, '', clean_title).strip(" :-–[]")
            if not clean_title:
                clean_title = f"Activity recorded in {source_id}"

            evidence_ref = EvidenceReference(
                source_id=source_id,
                source_type=source_type,
                snippet=line,
                confidence=1.0 if status == EpistemicStatus.OBSERVED else 0.75,
                recorded_at=timestamp
            )

            event = Event(
                id=event_id,
                title=clean_title[:80],
                description=line,
                status=status,
                temporal=TemporalAnchor(
                    start_time=timestamp,
                    is_interval=False,
                    is_approximate=(status != EpistemicStatus.OBSERVED)
                ),
                participants=participants,
                objects=objects,
                evidence_ids=[source_id],
                evidence_items=[evidence_ref],
                confidence=1.0 if status == EpistemicStatus.OBSERVED else (0.7 if status == EpistemicStatus.INFERRED else 0.4)
            )
            events.append(event)

        return events

    @staticmethod
    def get_llm_extraction_prompt_template() -> str:
        """
        Structured prompt specification for zero-shot / few-shot LLM extraction
        when integrating with OpenAI, Anthropic, or Gemini APIs.
        """
        return """
You are an expert Forensic & Intelligence Event Extractor.
Extract chronological events and relationships from the provided multi-source records.

For each event:
1. Provide an event ID.
2. Formulate a precise, factual title.
3. Categorize Epistemic Status:
   - "OBSERVED": Directly attested by concrete timestamp and primary evidence.
   - "INFERRED": Deduced from surrounding context, causality, or relative timing.
   - "UNKNOWN": Plausible or reported without temporal anchor or confidence.
4. Extract timestamps (ISO-8601 when available).
5. Extract participants (Person IDs) and objects (Asset/Device IDs).
6. Provide exact quote/snippet for evidence linkage.

Output strictly valid JSON matching the following schema:
{
  "events": [
    {
      "id": "EV_001",
      "title": "Badge swipe at Server Room B",
      "description": "...",
      "status": "OBSERVED",
      "start_time": "2026-10-30T14:22:10",
      "end_time": null,
      "participants": ["PERSON_ALICE"],
      "objects": ["DOOR_SR_B"],
      "evidence_snippet": "...",
      "source_id": "ACCESS_LOG_01"
    }
  ]
}
"""

