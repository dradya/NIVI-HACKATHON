"""
Evidence-Linked Timeline Generator & Multi-Format Exporter.
Produces:
- Interactive / Markdown Evidence-Linked Timelines
- Epistemic Status Badges (Observed, Inferred, Unknown)
- Person/Object Interaction matrices & trails
- Audit-grade JSON and Markdown reports with direct source snippets
"""

from __future__ import annotations
from typing import List, Dict, Optional
import datetime
from models import Event, EpistemicStatus, Entity, CrossSourceCorrelation


class EvidenceLinkedTimelineGenerator:
    def __init__(self, entities: Optional[Dict[str, Entity]] = None):
        self.entities = entities or {}

    def _resolve_names(self, ids: List[str]) -> str:
        names = [self.entities[i].name if i in self.entities else i for i in ids]
        return ", ".join(names) if names else "None"

    def _format_time(self, dt: Optional[datetime.datetime]) -> str:
        if dt is None:
            return "UNSPECIFIED / UNANCHORED"
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def generate_markdown_timeline(
        self,
        ordered_events: List[Event],
        correlations: Optional[List[CrossSourceCorrelation]] = None
    ) -> str:
        """
        Builds a rich, audit-grade markdown timeline with direct source links,
        epistemic status tags, and participant trails.
        """
        md = []
        md.append("# 🕒 Evidence-Supported Chronological Sequence of Events")
        md.append("")
        md.append("> **Epistemic Classification System:**")
        md.append("> - 🟢 **OBSERVED**: Direct, timestamped evidentiary record.")
        md.append("> - 🟡 **INFERRED**: Causally/temporally bounded deduction.")
        md.append("> - ⚪ **UNKNOWN**: Speculative or unanchored temporal reference.")
        md.append("")
        md.append("---")
        md.append("")

        for idx, ev in enumerate(ordered_events, 1):
            badge = "🟢 OBSERVED" if ev.status == EpistemicStatus.OBSERVED else (
                "🟡 INFERRED" if ev.status == EpistemicStatus.INFERRED else "⚪ UNKNOWN"
            )
            time_str = self._format_time(ev.temporal.start_time)
            
            md.append(f"### {idx}. [{badge}] `{time_str}` — {ev.title}")
            md.append(f"- **Event ID**: `{ev.id}`")
            md.append(f"- **Summary**: {ev.description}")
            md.append(f"- **Participants**: {self._resolve_names(ev.participants)}")
            md.append(f"- **Objects / Assets**: {self._resolve_names(ev.objects)}")
            
            if ev.inferred_reasoning:
                md.append(f"- **Deduction Justification**: *{ev.inferred_reasoning}*")

            # Evidence linking
            md.append("- **Supporting Evidence Links**:")
            if ev.evidence_items:
                for ev_ref in ev.evidence_items:
                    rec_time = f" (logged: {ev_ref.recorded_at})" if ev_ref.recorded_at else ""
                    md.append(f"  - **[{ev_ref.source_id}]** (`{ev_ref.source_type}`{rec_time}, confidence: {ev_ref.confidence * 100:.0f}%):")
                    md.append(f"    > \"{ev_ref.snippet}\"")
            else:
                md.append("  - *(No direct primary evidence cited)*")

            md.append("")

        if correlations:
            md.append("---")
            md.append("## 🔗 Cross-Source Corroboration & Correlations")
            md.append("")
            for c in correlations:
                md.append(f"- **Linked Events**: `{', '.join(c.event_ids)}` | **Type**: `{c.correlation_type}` | **Epistemic**: `{c.epistemic_status.value}`")
                md.append(f"  - **Justification**: {c.justification}")
                md.append(f"  - **Sources involved**: {', '.join(set(e.source_id for e in c.evidence_links))}")
                md.append("")

        return "\n".join(md)

    def generate_html_timeline_artifact(self, ordered_events: List[Event]) -> str:
        """Generates an interactive visual timeline report with CSS styling."""
        items_html = []
        for ev in ordered_events:
            color = "#10b981" if ev.status == EpistemicStatus.OBSERVED else (
                "#f59e0b" if ev.status == EpistemicStatus.INFERRED else "#6b7280"
            )
            time_str = self._format_time(ev.temporal.start_time)
            evidence_html = "".join([
                f'<div class="evidence-box"><strong>[{e.source_id}]</strong>: <em>"{e.snippet}"</em></div>'
                for e in ev.evidence_items
            ])

            items_html.append(f"""
            <div class="timeline-card" style="border-left: 5px solid {color};">
                <div class="header">
                    <span class="badge" style="background:{color};">{ev.status.value}</span>
                    <span class="time">{time_str}</span>
                </div>
                <h3>{ev.title}</h3>
                <p>{ev.description}</p>
                <div class="entities">
                    <strong>Participants:</strong> {self._resolve_names(ev.participants)} |
                    <strong>Objects:</strong> {self._resolve_names(ev.objects)}
                </div>
                {f'<div class="reasoning"><em>{ev.inferred_reasoning}</em></div>' if ev.inferred_reasoning else ''}
                <div class="evidence-section">
                    <strong>Evidence:</strong>
                    {evidence_html}
                </div>
            </div>
            """)

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Evidence-Supported Timeline</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }}
        h1 {{ text-align: center; color: #38bdf8; margin-bottom: 2rem; }}
        .timeline-container {{ max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }}
        .timeline-card {{ background: #1e293b; border-radius: 8px; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }}
        .header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }}
        .badge {{ font-size: 0.75rem; font-weight: bold; padding: 0.2rem 0.6rem; border-radius: 9999px; color: white; }}
        .time {{ font-family: monospace; color: #94a3b8; font-size: 0.9rem; }}
        .entities {{ margin: 0.5rem 0; font-size: 0.85rem; color: #cbd5e1; }}
        .reasoning {{ font-size: 0.85rem; color: #fbbf24; margin: 0.4rem 0; }}
        .evidence-section {{ margin-top: 0.8rem; border-top: 1px solid #334155; padding-top: 0.6rem; font-size: 0.85rem; }}
        .evidence-box {{ background: #0f172a; padding: 0.4rem 0.6rem; border-radius: 4px; margin-top: 0.3rem; border-left: 2px solid #38bdf8; }}
    </style>
</head>
<body>
    <h1>Evidence-Supported Chronological Timeline</h1>
    <div class="timeline-container">
        {''.join(items_html)}
    </div>
</body>
</html>
"""
        return html_content

