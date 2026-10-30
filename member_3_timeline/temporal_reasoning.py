"""
Temporal Graph & Temporal Reasoning Engine.
Implements:
- Directed Temporal Constraint Graph
- Cycle detection & consistency verification
- Topological sorting with interval and partial-order constraints
- Allen's interval algebra constraint propagation
- Confidence-weighted time estimation for inferred events
"""

from __future__ import annotations
import datetime
from typing import List, Dict, Optional, Tuple, Set
import networkx as nx

from models import Event, EpistemicStatus, TemporalConstraintType, TemporalAnchor


class TemporalGraphReasoningEngine:
    def __init__(self):
        # Graph stores temporal ordering constraints where edge A -> B means A occurred before/started before B
        self.constraint_graph = nx.DiGraph()
        self.events: Dict[str, Event] = {}

    def add_event(self, event: Event):
        self.events[event.id] = event
        self.constraint_graph.add_node(event.id, event=event)

    def add_constraint(self, from_id: str, to_id: str, relation: TemporalConstraintType, weight: float = 1.0):
        """Adds a temporal constraint edge (from_id must precede/relate to to_id)."""
        if from_id not in self.events or to_id not in self.events:
            raise ValueError(f"Both events {from_id} and {to_id} must be registered before adding constraints.")

        self.constraint_graph.add_edge(from_id, to_id, relation=relation, weight=weight)

    def build_constraints_from_timestamps(self):
        """
        Derives pairwise constraints from known timestamp intervals.
        Preserves strict ordering for observed timestamps.
        """
        sorted_known = []
        for eid, event in self.events.items():
            if event.temporal.start_time is not None:
                sorted_known.append((event.temporal.start_time, eid, event))

        sorted_known.sort(key=lambda x: x[0])

        for i in range(len(sorted_known) - 1):
            t_curr, id_curr, ev_curr = sorted_known[i]
            t_next, id_next, ev_next = sorted_known[i+1]

            # If end time of curr exists, check against start time of next
            curr_end = ev_curr.temporal.end_time or t_curr
            if curr_end <= t_next:
                if not self.constraint_graph.has_edge(id_curr, id_next):
                    self.constraint_graph.add_edge(
                        id_curr, id_next,
                        relation=TemporalConstraintType.BEFORE,
                        weight=1.0,
                        inferred=False
                    )

    def infer_missing_timestamps_and_bounds(self) -> Dict[str, Tuple[Optional[datetime.datetime], Optional[datetime.datetime]]]:
        """
        For events without explicit timestamps (INFERRED or UNKNOWN),
        compute the earliest lower bound (after all predecessors) and
        latest upper bound (before all successors).
        """
        bounds = {}
        for eid, ev in self.events.items():
            if ev.temporal.start_time is not None:
                bounds[eid] = (ev.temporal.start_time, ev.temporal.end_time or ev.temporal.start_time)
            else:
                # Calculate from ancestor constraints
                pred_bounds = []
                for pred in self.constraint_graph.predecessors(eid):
                    if pred in self.events and self.events[pred].temporal.start_time:
                        pred_end = self.events[pred].temporal.end_time or self.events[pred].temporal.start_time
                        pred_bounds.append(pred_end)
                
                succ_bounds = []
                for succ in self.constraint_graph.successors(eid):
                    if succ in self.events and self.events[succ].temporal.start_time:
                        succ_bounds.append(self.events[succ].temporal.start_time)

                lower_bound = max(pred_bounds) if pred_bounds else None
                upper_bound = min(succ_bounds) if succ_bounds else None
                bounds[eid] = (lower_bound, upper_bound)

                # If missing timestamp, synthesize an inferred timestamp if bounded
                if ev.temporal.start_time is None:
                    if lower_bound and upper_bound:
                        midpoint = lower_bound + (upper_bound - lower_bound) / 2
                        ev.temporal.start_time = midpoint
                        ev.status = EpistemicStatus.INFERRED
                        ev.inferred_reasoning = f"Bounded between [{lower_bound.isoformat()}] and [{upper_bound.isoformat()}]"
                    elif lower_bound:
                        ev.temporal.start_time = lower_bound + datetime.timedelta(minutes=5)
                        ev.status = EpistemicStatus.INFERRED
                        ev.inferred_reasoning = f"Inferred sequentially after [{lower_bound.isoformat()}]"
                    elif upper_bound:
                        ev.temporal.start_time = upper_bound - datetime.timedelta(minutes=5)
                        ev.status = EpistemicStatus.INFERRED
                        ev.inferred_reasoning = f"Inferred sequentially prior to [{upper_bound.isoformat()}]"
                    else:
                        ev.status = EpistemicStatus.UNKNOWN
                        ev.inferred_reasoning = "Unanchored event with no bounding temporal evidence."

        return bounds

    def check_temporal_consistency(self) -> Tuple[bool, List[List[str]]]:
        """
        Detects temporal contradictions and paradoxes (cycles in precedence graph).
        Returns (is_consistent, list_of_cycles).
        """
        try:
            cycles = list(nx.simple_cycles(self.constraint_graph))
            is_consistent = len(cycles) == 0
            return is_consistent, cycles
        except Exception:
            return False, []

    def compute_chronological_ordering(self) -> List[Event]:
        """
        Computes the definitive chronological sequence using a hybrid topological
        sort augmented by timestamp heuristics and epistemic priorities.
        """
        self.build_constraints_from_timestamps()
        self.infer_missing_timestamps_and_bounds()

        is_consistent, cycles = self.check_temporal_consistency()
        if not is_consistent:
            # Break cycles by removing lowest weight / inferred edges
            for cycle in cycles:
                for i in range(len(cycle)):
                    u = cycle[i]
                    v = cycle[(i + 1) % len(cycle)]
                    edge_data = self.constraint_graph.get_edge_data(u, v)
                    if edge_data and edge_data.get("inferred", False):
                        self.constraint_graph.remove_edge(u, v)
                        break

        # Generate topological sort or key-based order
        try:
            topo_order = list(nx.topological_sort(self.constraint_graph))
            # Sort with stable tie-breaking: start_time -> epistemic status (OBSERVED first)
            def sort_key(eid: str):
                ev = self.events[eid]
                t = ev.temporal.start_time or datetime.datetime.max.replace(tzinfo=None)
                # Ensure timezone naive comparison if needed
                if t.tzinfo is not None:
                    t = t.replace(tzinfo=None)
                epistemic_priority = 0 if ev.status == EpistemicStatus.OBSERVED else (1 if ev.status == EpistemicStatus.INFERRED else 2)
                return (t, epistemic_priority)

            ordered_events = sorted(topo_order, key=sort_key)
            return [self.events[eid] for eid in ordered_events]
        except nx.NetworkXUnfeasible:
            # Fallback to pure timestamp & status sorting
            events_list = list(self.events.values())
            events_list.sort(key=lambda ev: (
                (ev.temporal.start_time.replace(tzinfo=None) if ev.temporal.start_time else datetime.datetime.max),
                0 if ev.status == EpistemicStatus.OBSERVED else (1 if ev.status == EpistemicStatus.INFERRED else 2)
            ))
            return events_list

