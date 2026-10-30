"""
Spatial Geometry Engine for 3D Positioning, Spatial Graph Generation,
Floor Plan logic, Camera Estimation, and Three.js formatting.
Optimized with NumPy and Shapely.
"""

import math
import numpy as np
from typing import List, Dict, Tuple, Optional
from shapely.geometry import Polygon, box

from backend.schemas import (
    Vector3D,
    Vector2D,
    Rotation3D,
    Dimensions3D,
    UncertaintyMetrics,
    SpatialRelationship,
    SpatialRelationType,
    CameraPose,
    RoomBounds,
    FloorPlanData,
    WallSegment2D,
    DoorWindow2D,
    Object2D,
    ThreeJsObjectNode,
    ThreeJsMaterial,
    ThreeJsSceneData,
    RawDetectionInput,
)

# Standard architectural furniture & element catalog with canonical dimensions (width, height, depth) in meters
CANONICAL_DIMENSIONS = {
    "sofa": Dimensions3D(width=2.1, height=0.85, depth=0.9),
    "couch": Dimensions3D(width=2.1, height=0.85, depth=0.9),
    "coffee table": Dimensions3D(width=1.2, height=0.45, depth=0.6),
    "table": Dimensions3D(width=1.4, height=0.75, depth=0.8),
    "dining table": Dimensions3D(width=1.8, height=0.76, depth=0.9),
    "chair": Dimensions3D(width=0.55, height=0.85, depth=0.55),
    "armchair": Dimensions3D(width=0.85, height=0.85, depth=0.85),
    "bed": Dimensions3D(width=1.8, height=0.6, depth=2.0),
    "nightstand": Dimensions3D(width=0.5, height=0.55, depth=0.45),
    "desk": Dimensions3D(width=1.4, height=0.75, depth=0.7),
    "tv": Dimensions3D(width=1.25, height=0.75, depth=0.1),
    "tv stand": Dimensions3D(width=1.6, height=0.5, depth=0.45),
    "bookshelf": Dimensions3D(width=1.0, height=1.9, depth=0.35),
    "wardrobe": Dimensions3D(width=1.2, height=2.1, depth=0.6),
    "refrigerator": Dimensions3D(width=0.75, height=1.8, depth=0.7),
    "counter": Dimensions3D(width=2.0, height=0.9, depth=0.65),
    "cabinet": Dimensions3D(width=0.9, height=0.85, depth=0.4),
    "lamp": Dimensions3D(width=0.4, height=1.5, depth=0.4),
    "plant": Dimensions3D(width=0.4, height=0.8, depth=0.4),
    "rug": Dimensions3D(width=2.4, height=0.02, depth=1.6),
    "door": Dimensions3D(width=0.9, height=2.1, depth=0.1),
    "window": Dimensions3D(width=1.2, height=1.2, depth=0.15),
}

# Theme palette for vibrant 3D rendering
CATEGORY_COLORS = {
    "seating": "#4338ca",     # Deep indigo
    "table": "#d97706",       # Amber / wood
    "bed": "#059669",         # Emerald
    "storage": "#b45309",     # Warm cedar
    "electronics": "#0284c7", # Cyan
    "decor": "#e11d48",       # Rose
    "appliance": "#475569",   # Slate steel
    "default": "#6366f1",     # Violet
}

CATEGORY_MAP = {
    "sofa": "seating",
    "couch": "seating",
    "chair": "seating",
    "armchair": "seating",
    "coffee table": "table",
    "table": "table",
    "dining table": "table",
    "desk": "table",
    "bed": "bed",
    "nightstand": "storage",
    "bookshelf": "storage",
    "wardrobe": "storage",
    "cabinet": "storage",
    "tv": "electronics",
    "tv stand": "storage",
    "lamp": "decor",
    "plant": "decor",
    "rug": "decor",
    "refrigerator": "appliance",
    "counter": "appliance",
}


def get_canonical_dimensions(label: str) -> Dimensions3D:
    clean_label = label.lower().strip()
    for key, dim in CANONICAL_DIMENSIONS.items():
        if key in clean_label:
            return dim
    return Dimensions3D(width=0.8, height=0.8, depth=0.8)


def get_category_color(label: str) -> str:
    clean_label = label.lower().strip()
    for key, cat in CATEGORY_MAP.items():
        if key in clean_label:
            return CATEGORY_COLORS.get(cat, CATEGORY_COLORS["default"])
    return CATEGORY_COLORS["default"]


class SpatialReconstructionEngine:
    """
    High-performance spatial reasoning & reconstruction engine.
    Computes 3D coordinates from 2D bounding boxes, infers physical collision-free poses,
    determines spatial topologies, calculates camera parameters, and extracts 2D floor plans.
    """

    def __init__(self, room_width: float = 6.0, room_length: float = 6.0, room_height: float = 2.8):
        self.room_width = room_width
        self.room_length = room_length
        self.room_height = room_height
        self.half_w = room_width / 2.0
        self.half_l = room_length / 2.0

    def estimate_camera_pose(self, objects_3d: List[ThreeJsObjectNode]) -> CameraPose:
        """
        Estimates the optimal camera vantage point, field of view, and orientation
        based on reconstructed objects spread across the room.
        """
        if not objects_3d:
            return CameraPose(
                position=Vector3D(x=0.0, y=2.0, z=self.half_l + 1.5),
                rotation=Rotation3D(x=-0.25, y=0.0, z=0.0),
                fov=60.0,
                camera_height_ground=2.0
            )

        # Compute centroid of all reconstructed objects
        positions = np.array([[obj.position.x, obj.position.y, obj.position.z] for obj in objects_3d])
        centroid = np.mean(positions, axis=0)

        # Distance camera to encompass room bounds
        cam_z = max(self.half_l + 1.2, float(np.max(positions[:, 2])) + 2.0)
        cam_y = min(2.5, self.room_height * 0.75)
        cam_x = float(centroid[0] * 0.3)  # Slightly offset for natural 3/4 perspective

        # Pitch angle toward scene center
        dx = centroid[0] - cam_x
        dy = centroid[1] - cam_y
        dz = centroid[2] - cam_z
        pitch = math.atan2(dy, math.sqrt(dx**2 + dz**2))
        yaw = math.atan2(-dx, -dz)

        return CameraPose(
            position=Vector3D(x=round(cam_x, 2), y=round(cam_y, 2), z=round(cam_z, 2)),
            rotation=Rotation3D(x=round(pitch, 3), y=round(yaw, 3), z=0.0),
            fov=58.0,
            camera_height_ground=round(cam_y, 2)
        )

    def reconstruct_from_detections(
        self,
        detections: List[RawDetectionInput],
        camera: Optional[CameraPose] = None
    ) -> List[ThreeJsObjectNode]:
        """
        Converts 2D bounding boxes and raw vision detections into true 3D spatial entities.
        Applies inverse perspective projection, ground alignment, and collision relaxation.
        """
        if camera is None:
            camera = CameraPose(
                position=Vector3D(x=0.0, y=1.6, z=self.half_l),
                rotation=Rotation3D(x=-0.15, y=0.0, z=0.0),
                fov=60.0
            )

        objects_3d: List[ThreeJsObjectNode] = []
        occupied_polygons = []

        # Sort detections: larger / background objects first
        sorted_dets = sorted(detections, key=lambda d: (d.box_2d[2] - d.box_2d[0]) * (d.box_2d[3] - d.box_2d[1]) if d.box_2d else 0.5, reverse=True)

        for idx, det in enumerate(sorted_dets):
            label = det.label.lower()
            dims = get_canonical_dimensions(label)
            confidence = det.confidence or 0.85

            if det.box_2d and len(det.box_2d) == 4:
                ymin, xmin, ymax, xmax = det.box_2d
                box_center_x = (xmin + xmax) / 2.0
                box_center_y = (ymin + ymax) / 2.0
                box_h = max(0.01, ymax - ymin)

                # Estimated distance (depth Z) if not provided by hardware sensor
                if det.estimated_distance:
                    depth_z = det.estimated_distance
                else:
                    # Inverse focal mapping: apparent height inversely proportional to distance
                    focal_factor = 1.8
                    depth_z = float(np.clip((dims.height / box_h) * focal_factor, 1.0, self.room_length))

                # Lateral position X via pinhole projection
                aspect_ratio = 16.0 / 9.0
                tan_half_fov = math.tan(math.radians(camera.fov / 2.0))
                norm_x = (box_center_x - 0.5) * 2.0
                world_x = float(norm_x * depth_z * tan_half_fov * aspect_ratio)

                # Floor resting position (Y elevation)
                # Objects normally rest on floor Y = 0 (so center Y is height/2)
                if "tv" in label and "stand" not in label:
                    # Mounted TV or wall item
                    world_y = 1.4
                    depth_z = -self.half_l + 0.15  # against back wall
                elif "shelf" in label or "cabinet" in label:
                    world_y = dims.height / 2.0
                else:
                    world_y = dims.height / 2.0

                # World Z relative to room center
                world_z = float(camera.position.z - depth_z)
            else:
                # Default heuristic placement if no 2D box is given
                world_x = float(np.random.uniform(-self.half_w * 0.6, self.half_w * 0.6))
                world_z = float(np.random.uniform(-self.half_l * 0.6, self.half_l * 0.6))
                world_y = dims.height / 2.0

            # Clamp coordinates to stay within room boundary
            world_x = float(np.clip(world_x, -self.half_w + dims.width / 2.0, self.half_w - dims.width / 2.0))
            world_z = float(np.clip(world_z, -self.half_l + dims.depth / 2.0, self.half_l - dims.depth / 2.0))

            # Collision relaxation / anti-overlap via 2D bounding boxes (X, Z plane)
            poly = box(
                world_x - dims.width / 2.0,
                world_z - dims.depth / 2.0,
                world_x + dims.width / 2.0,
                world_z + dims.depth / 2.0
            )

            # Shift if overlap detected
            for other_poly in occupied_polygons:
                if poly.intersects(other_poly):
                    overlap_area = poly.intersection(other_poly).area
                    if overlap_area > 0.05:
                        # Shift along X or Z
                        shift_offset = 0.3
                        if abs(world_x) < abs(world_z):
                            world_x += shift_offset if world_x >= 0 else -shift_offset
                        else:
                            world_z += shift_offset if world_z >= 0 else -shift_offset
                        # Rebuild polygon
                        poly = box(
                            world_x - dims.width / 2.0,
                            world_z - dims.depth / 2.0,
                            world_x + dims.width / 2.0,
                            world_z + dims.depth / 2.0
                        )

            occupied_polygons.append(poly)

            # Calculate uncertainty metrics based on distance and confidence
            pos_std = Vector3D(
                x=round(0.04 + (1.0 - confidence) * 0.1, 3),
                y=round(0.02 + (1.0 - confidence) * 0.05, 3),
                z=round(0.08 + (depth_z if 'depth_z' in locals() else 2.0) * 0.03 * (1.0 - confidence), 3)
            )

            # Node creation
            node_id = f"obj_{idx+1}_{label.replace(' ', '_')}"
            min_pt = Vector3D(
                x=round(world_x - dims.width / 2.0, 3),
                y=round(world_y - dims.height / 2.0, 3),
                z=round(world_z - dims.depth / 2.0, 3)
            )
            max_pt = Vector3D(
                x=round(world_x + dims.width / 2.0, 3),
                y=round(world_y + dims.height / 2.0, 3),
                z=round(world_z + dims.depth / 2.0, 3)
            )

            obj_node = ThreeJsObjectNode(
                id=node_id,
                name=f"{det.label.title()} {idx+1}",
                category=CATEGORY_MAP.get(label, "furniture"),
                geometry_type="box",
                position=Vector3D(x=round(world_x, 3), y=round(world_y, 3), z=round(world_z, 3)),
                rotation=Rotation3D(x=0.0, y=0.0, z=0.0),
                scale=Vector3D(x=dims.width, y=dims.height, z=dims.depth),
                material=ThreeJsMaterial(
                    color=get_category_color(label),
                    metalness=0.15,
                    roughness=0.5
                ),
                uncertainty=UncertaintyMetrics(
                    position_std=pos_std,
                    confidence=confidence,
                    detection_source="vision_ai_pipeline"
                ),
                bounding_box_min=min_pt,
                bounding_box_max=max_pt,
                userData={
                    "original_label": det.label,
                    "confidence_pct": round(confidence * 100, 1),
                    "volume_m3": round(dims.width * dims.height * dims.depth, 3)
                }
            )
            objects_3d.append(obj_node)

        return objects_3d

    def compute_spatial_relationships(
        self,
        objects_3d: List[ThreeJsObjectNode]
    ) -> List[SpatialRelationship]:
        """
        Determines multi-directional spatial topologies:
        - Left / Right
        - In-front-of / Behind
        - Near / Far
        - Supported-by / Above / Inside
        """
        relations: List[SpatialRelationship] = []
        n = len(objects_3d)

        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                A = objects_3d[i]
                B = objects_3d[j]

                dx = A.position.x - B.position.x
                dy = A.position.y - B.position.y
                dz = A.position.z - B.position.z
                dist = math.sqrt(dx**2 + dy**2 + dz**2)

                # Proximity
                if dist < 1.5:
                    relations.append(SpatialRelationship(
                        source_id=A.id,
                        target_id=B.id,
                        relation=SpatialRelationType.NEAR,
                        distance_meters=round(dist, 2),
                        confidence=round(max(0.7, 1.0 - (dist / 2.0)), 2),
                        qualitative_description=f"{A.name} is near {B.name} ({round(dist, 2)}m apart)"
                    ))
                elif dist > 3.0:
                    relations.append(SpatialRelationship(
                        source_id=A.id,
                        target_id=B.id,
                        relation=SpatialRelationType.FAR_FROM,
                        distance_meters=round(dist, 2),
                        confidence=0.85,
                        qualitative_description=f"{A.name} is far from {B.name}"
                    ))

                # Lateral Relations (Left / Right)
                if abs(dx) > 0.4 and abs(dz) < 1.8:
                    if dx < -0.3:
                        relations.append(SpatialRelationship(
                            source_id=A.id,
                            target_id=B.id,
                            relation=SpatialRelationType.LEFT_OF,
                            distance_meters=round(abs(dx), 2),
                            confidence=0.9,
                            qualitative_description=f"{A.name} is to the left of {B.name}"
                        ))
                    elif dx > 0.3:
                        relations.append(SpatialRelationship(
                            source_id=A.id,
                            target_id=B.id,
                            relation=SpatialRelationType.RIGHT_OF,
                            distance_meters=round(abs(dx), 2),
                            confidence=0.9,
                            qualitative_description=f"{A.name} is to the right of {B.name}"
                        ))

                # Depth Relations (In front / Behind)
                if abs(dz) > 0.4:
                    if dz > 0.3:
                        relations.append(SpatialRelationship(
                            source_id=A.id,
                            target_id=B.id,
                            relation=SpatialRelationType.IN_FRONT_OF,
                            distance_meters=round(abs(dz), 2),
                            confidence=0.88,
                            qualitative_description=f"{A.name} is in front of {B.name}"
                        ))
                    elif dz < -0.3:
                        relations.append(SpatialRelationship(
                            source_id=A.id,
                            target_id=B.id,
                            relation=SpatialRelationType.BEHIND,
                            distance_meters=round(abs(dz), 2),
                            confidence=0.88,
                            qualitative_description=f"{A.name} is behind {B.name}"
                        ))

                # Support / Elevation
                if dy > 0.3 and dist < 1.2:
                    relations.append(SpatialRelationship(
                        source_id=A.id,
                        target_id=B.id,
                        relation=SpatialRelationType.ABOVE,
                        distance_meters=round(dy, 2),
                        confidence=0.92,
                        qualitative_description=f"{A.name} is positioned above {B.name}"
                    ))

        return relations

    def generate_floor_plan(
        self,
        objects_3d: List[ThreeJsObjectNode],
        room_name: str = "Living Area"
    ) -> FloorPlanData:
        """
        Projects 3D reconstructed scene onto an accurate 2D floor-plan schema
        with perimeter walls, door/window openings, and object footprints.
        """
        half_w = self.half_w
        half_l = self.half_l

        # Define 4 perimeter walls
        walls = [
            WallSegment2D(
                id="wall_north",
                start=Vector2D(x=-half_w, y=half_l),
                end=Vector2D(x=half_w, y=half_l),
                thickness=0.15,
                height=self.room_height
            ),
            WallSegment2D(
                id="wall_east",
                start=Vector2D(x=half_w, y=half_l),
                end=Vector2D(x=half_w, y=-half_l),
                thickness=0.15,
                height=self.room_height
            ),
            WallSegment2D(
                id="wall_south",
                start=Vector2D(x=half_w, y=-half_l),
                end=Vector2D(x=-half_w, y=-half_l),
                thickness=0.15,
                height=self.room_height
            ),
            WallSegment2D(
                id="wall_west",
                start=Vector2D(x=-half_w, y=-half_l),
                end=Vector2D(x=-half_w, y=half_l),
                thickness=0.15,
                height=self.room_height
            ),
        ]

        # Standard entryway door & window openings
        openings = [
            DoorWindow2D(
                id="door_entry",
                type="door",
                wall_id="wall_south",
                start=Vector2D(x=-0.5, y=-half_l),
                end=Vector2D(x=0.5, y=-half_l),
                opening_width=1.0
            ),
            DoorWindow2D(
                id="window_main",
                type="window",
                wall_id="wall_north",
                start=Vector2D(x=-1.2, y=half_l),
                end=Vector2D(x=1.2, y=half_l),
                opening_width=2.4
            )
        ]

        # Convert 3D objects to 2D footprints (mapping 3D X -> 2D X, 3D Z -> 2D Y)
        objects_2d: List[Object2D] = []
        for obj in objects_3d:
            objects_2d.append(Object2D(
                id=obj.id,
                name=obj.name,
                category=obj.category,
                center=Vector2D(x=obj.position.x, y=obj.position.z),
                size=Vector2D(x=obj.scale.x, y=obj.scale.z),
                rotation_deg=math.degrees(obj.rotation.y),
                color=obj.material.color,
                confidence=obj.uncertainty.confidence
            ))

        return FloorPlanData(
            room_name=room_name,
            bounds={
                "min_x": -half_w,
                "max_x": half_w,
                "min_y": -half_l,
                "max_y": half_l
            },
            area_sqm=round(self.room_width * self.room_length, 2),
            walls=walls,
            openings=openings,
            objects=objects_2d,
            grid_size_meters=0.5
        )

    def assemble_threejs_scene(
        self,
        objects_3d: List[ThreeJsObjectNode],
        camera: CameraPose,
        spatial_graph: List[SpatialRelationship]
    ) -> ThreeJsSceneData:
        """
        Assembles a comprehensive, client-ready Three.js scene with lighting rigs,
        room bounding box, geometry buffers, uncertainty bounds, and physics attributes.
        """
        lighting = [
            {
                "type": "AmbientLight",
                "color": "#ffffff",
                "intensity": 0.65
            },
            {
                "type": "DirectionalLight",
                "color": "#f8fafc",
                "intensity": 0.85,
                "position": {"x": 4.0, "y": 6.0, "z": 4.0},
                "castShadow": True,
                "shadowMapSize": 2048
            },
            {
                "type": "PointLight",
                "color": "#fbbf24",
                "intensity": 0.4,
                "position": {"x": 0.0, "y": 2.5, "z": 0.0}
            }
        ]

        bounds = RoomBounds(
            min_point=Vector3D(x=-self.half_w, y=0.0, z=-self.half_l),
            max_point=Vector3D(x=self.half_w, y=self.room_height, z=self.half_l),
            room_type="living_room",
            floor_area_sqm=round(self.room_width * self.room_length, 2)
        )

        return ThreeJsSceneData(
            version="1.0.0",
            metadata={
                "generated_by": "Cosmos3 / SpatialReconstructionEngine",
                "object_count": len(objects_3d),
                "spatial_edge_count": len(spatial_graph),
                "room_dimensions_m": {
                    "width": self.room_width,
                    "length": self.room_length,
                    "height": self.room_height
                }
            },
            camera=camera,
            lighting=lighting,
            room_bounds=bounds,
            objects=objects_3d,
            spatial_graph=spatial_graph
        )
