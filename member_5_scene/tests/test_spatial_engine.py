"""
Comprehensive Unit and Integration Tests for Spatial Reconstruction Engine,
Spatial Relationships, Floor Plan Generation, and Nebius Reasoner Fallback.
"""

import pytest
from backend.schemas import RawDetectionInput, Vector3D
from backend.spatial_engine import SpatialReconstructionEngine, get_canonical_dimensions
from backend.nebius_reasoner import NebiusCosmosReasoner


def test_canonical_dimensions():
    sofa_dim = get_canonical_dimensions("sofa")
    assert sofa_dim.width >= 2.0
    assert sofa_dim.height > 0.5


def test_reconstruction_pipeline():
    engine = SpatialReconstructionEngine(room_width=6.0, room_length=6.0, room_height=2.8)
    detections = [
        RawDetectionInput(label="sofa", box_2d=[0.45, 0.2, 0.85, 0.8], confidence=0.95),
        RawDetectionInput(label="coffee table", box_2d=[0.6, 0.35, 0.85, 0.65], confidence=0.92),
        RawDetectionInput(label="tv stand", box_2d=[0.5, 0.32, 0.7, 0.68], confidence=0.90),
    ]

    objects_3d = engine.reconstruct_from_detections(detections)
    assert len(objects_3d) == 3

    # Check bounds
    for obj in objects_3d:
        assert -3.0 <= obj.position.x <= 3.0
        assert -3.0 <= obj.position.z <= 3.0
        assert obj.position.y > 0.0

    # Test camera pose estimation
    camera = engine.estimate_camera_pose(objects_3d)
    assert camera.position.y > 1.0
    assert camera.fov == 58.0

    # Test spatial relationships
    relations = engine.compute_spatial_relationships(objects_3d)
    assert len(relations) > 0

    # Test 2D floor plan extraction
    floor_plan = engine.generate_floor_plan(objects_3d)
    assert len(floor_plan.walls) == 4
    assert len(floor_plan.objects) == 3
    assert floor_plan.area_sqm == 36.0

    # Test Three.js assembly
    scene_data = engine.assemble_threejs_scene(objects_3d, camera, relations)
    assert len(scene_data.objects) == 3
    assert scene_data.metadata["object_count"] == 3


def test_nebius_reasoner_fallback():
    reasoner = NebiusCosmosReasoner(api_key=None)
    result = reasoner.reason_scene("Modern living room with couch and coffee table")
    assert "room_dimensions" in result
    assert "objects" in result
    assert len(result["objects"]) > 0
