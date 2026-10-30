"""
FastAPI Backend Application for 2D Floor Plan & 3D Scene Reconstruction.
Provides high-performance endpoints for:
- 3D Scene Reconstruction (Three.js ready)
- 2D Floor Plan extraction
- Spatial scene graph queries & relation matrices
- Nebius Cosmos3-Super-Reasoner integration
- Static visualizer mounting
"""

import time
import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, Any, List

from backend.schemas import (
    SceneReconstructionRequest,
    ThreeJsSceneData,
    FloorPlanData,
    SpatialRelationship,
    RawDetectionInput,
)
from backend.spatial_engine import SpatialReconstructionEngine
from backend.nebius_reasoner import NebiusCosmosReasoner

app = FastAPI(
    title="Spatial 3D Reconstruction & Floor Plan Engine",
    description="High-accuracy 3D spatial intelligence, Three.js scene generation, 2D floor plans, and spatial reasoning using Nebius Cosmos3-Super-Reasoner.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nebius_reasoner = NebiusCosmosReasoner()


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "nebius_configured": nebius_reasoner.is_configured(),
        "nebius_base_url": nebius_reasoner.base_url,
        "model": nebius_reasoner.model_id
    }


@app.post("/api/reconstruct", response_model=Dict[str, Any])
def reconstruct_scene(request: SceneReconstructionRequest):
    """
    Main reconstruction pipeline:
    1. Interprets raw detections or natural language prompt via Nebius Cosmos3-Super-Reasoner.
    2. Computes collision-free 3D coordinates (x, y, z) and bounding scales.
    3. Infers spatial relationships (left/right, near/far, above/behind).
    4. Generates camera pose and metadata.
    5. Formats Three.js-ready JSON and 2D floor plan JSON.
    """
    t0 = time.time()
    room_w = request.room_width or 6.0
    room_l = request.room_length or 6.0
    room_h = request.room_height or 2.8

    engine = SpatialReconstructionEngine(
        room_width=room_w,
        room_length=room_l,
        room_height=room_h
    )

    # If natural language description provided, pass through Nebius reasoner
    detections: List[RawDetectionInput] = []
    reasoning_notes = ""

    if request.natural_language_description or request.use_nebius_reasoner:
        desc = request.natural_language_description or f"A standard {request.room_type} with essential furniture"
        input_dets = [d.model_dump() for d in (request.detections or [])]
        reasoned = nebius_reasoner.reason_scene(desc, input_dets)
        reasoning_notes = reasoned.get("reasoning_summary", "Cosmos3 spatial reasoning applied")

        # Convert reasoned objects into detection inputs
        for obj in reasoned.get("objects", []):
            detections.append(RawDetectionInput(
                label=obj.get("label", "furniture"),
                box_2d=obj.get("box_2d"),
                confidence=obj.get("confidence", 0.92)
            ))
    elif request.detections and len(request.detections) > 0:
        detections = request.detections
    else:
        # Default sample if nothing sent
        detections = [
            RawDetectionInput(label="sofa", box_2d=[0.45, 0.2, 0.85, 0.8], confidence=0.96),
            RawDetectionInput(label="coffee table", box_2d=[0.6, 0.35, 0.85, 0.65], confidence=0.93),
            RawDetectionInput(label="tv stand", box_2d=[0.5, 0.32, 0.7, 0.68], confidence=0.91),
            RawDetectionInput(label="tv", box_2d=[0.2, 0.35, 0.5, 0.65], confidence=0.94),
            RawDetectionInput(label="armchair", box_2d=[0.48, 0.05, 0.82, 0.25], confidence=0.88),
            RawDetectionInput(label="plant", box_2d=[0.4, 0.85, 0.8, 0.96], confidence=0.85),
        ]

    # Step 1: Reconstruct 3D object bounding boxes and coordinates
    objects_3d = engine.reconstruct_from_detections(detections)

    # Step 2: Estimate camera pose
    camera_pose = engine.estimate_camera_pose(objects_3d)

    # Step 3: Compute spatial relationships (spatial scene graph)
    spatial_graph = engine.compute_spatial_relationships(objects_3d)

    # Step 4: Extract 2D floor plan
    floor_plan = engine.generate_floor_plan(objects_3d, room_name=f"{request.room_type.title()} Floor Plan")

    # Step 5: Format Three.js scene
    threejs_scene = engine.assemble_threejs_scene(objects_3d, camera_pose, spatial_graph)

    elapsed_ms = round((time.time() - t0) * 1000, 2)

    return {
        "status": "success",
        "computation_time_ms": elapsed_ms,
        "reasoning_summary": reasoning_notes,
        "threejs_scene": threejs_scene.model_dump(),
        "floor_plan": floor_plan.model_dump(),
        "object_count": len(objects_3d),
        "relationships_count": len(spatial_graph)
    }


@app.get("/api/presets")
def get_room_presets():
    """Provides instant preset templates for quick testing"""
    return {
        "living_room": {
            "title": "Modern Living Room",
            "prompt": "Modern Scandinavian living room with a 3-seater sofa, minimalist coffee table, media console with 65-inch TV, accent armchair, and indoor plant.",
            "room_width": 6.0,
            "room_length": 5.5,
            "room_height": 2.8,
            "detections": [
                {"label": "sofa", "box_2d": [0.45, 0.2, 0.85, 0.8], "confidence": 0.97},
                {"label": "coffee table", "box_2d": [0.6, 0.35, 0.85, 0.65], "confidence": 0.94},
                {"label": "tv stand", "box_2d": [0.5, 0.32, 0.7, 0.68], "confidence": 0.92},
                {"label": "tv", "box_2d": [0.2, 0.35, 0.5, 0.65], "confidence": 0.95},
                {"label": "armchair", "box_2d": [0.48, 0.05, 0.82, 0.25], "confidence": 0.89},
                {"label": "plant", "box_2d": [0.4, 0.85, 0.8, 0.96], "confidence": 0.87}
            ]
        },
        "master_bedroom": {
            "title": "Master Bedroom",
            "prompt": "Master bedroom featuring a king-size bed flanked by two symmetrical nightstands, bedside lamps, and a wardrobe closet against the side wall.",
            "room_width": 5.5,
            "room_length": 5.0,
            "room_height": 2.7,
            "detections": [
                {"label": "bed", "box_2d": [0.35, 0.25, 0.85, 0.75], "confidence": 0.98},
                {"label": "nightstand", "box_2d": [0.5, 0.08, 0.8, 0.23], "confidence": 0.92},
                {"label": "nightstand", "box_2d": [0.5, 0.77, 0.8, 0.92], "confidence": 0.91},
                {"label": "wardrobe", "box_2d": [0.2, 0.82, 0.9, 0.98], "confidence": 0.90},
                {"label": "lamp", "box_2d": [0.38, 0.1, 0.55, 0.2], "confidence": 0.93}
            ]
        },
        "home_office": {
            "title": "Executive Home Office",
            "prompt": "Contemporary home study with an executive wooden desk, ergonomic chair, tall bookshelf, and reading lamp.",
            "room_width": 4.5,
            "room_length": 4.5,
            "room_height": 2.8,
            "detections": [
                {"label": "desk", "box_2d": [0.4, 0.25, 0.8, 0.75], "confidence": 0.96},
                {"label": "chair", "box_2d": [0.45, 0.4, 0.85, 0.6], "confidence": 0.95},
                {"label": "bookshelf", "box_2d": [0.15, 0.82, 0.9, 0.98], "confidence": 0.92},
                {"label": "lamp", "box_2d": [0.3, 0.28, 0.48, 0.38], "confidence": 0.90},
                {"label": "plant", "box_2d": [0.55, 0.08, 0.85, 0.22], "confidence": 0.88}
            ]
        }
    }


# Mount frontend static directory if exists
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
