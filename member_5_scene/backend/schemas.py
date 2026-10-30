"""
Pydantic Schemas for 2D Floor Plan & 3D Scene Reconstruction System.
Supports standard Three.js entities, confidence scoring, uncertainty bounding,
and spatial scene graphs.
"""

from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from enum import Enum


class SpatialRelationType(str, Enum):
    LEFT_OF = "left_of"
    RIGHT_OF = "right_of"
    IN_FRONT_OF = "in_front_of"
    BEHIND = "behind"
    NEAR = "near"
    FAR_FROM = "far_from"
    INSIDE = "inside"
    SUPPORTED_BY = "supported_by"
    ABOVE = "above"
    BELOW = "below"
    ALIGNED_WITH = "aligned_with"


class Vector3D(BaseModel):
    x: float = Field(..., description="X coordinate in meters (lateral / horizontal)")
    y: float = Field(..., description="Y coordinate in meters (elevation / vertical up)")
    z: float = Field(..., description="Z coordinate in meters (depth / distance forward/back)")


class Vector2D(BaseModel):
    x: float = Field(..., description="X coordinate in 2D floor plan (meters)")
    y: float = Field(..., description="Y coordinate in 2D floor plan (meters)")


class Dimensions3D(BaseModel):
    width: float = Field(..., description="Width (along X axis) in meters")
    height: float = Field(..., description="Height (along Y axis) in meters")
    depth: float = Field(..., description="Depth (along Z axis) in meters")


class Rotation3D(BaseModel):
    x: float = Field(0.0, description="Pitch in radians")
    y: float = Field(0.0, description="Yaw in radians")
    z: float = Field(0.0, description="Roll in radians")


class UncertaintyMetrics(BaseModel):
    position_std: Vector3D = Field(
        default_factory=lambda: Vector3D(x=0.05, y=0.05, z=0.08),
        description="Standard deviation estimate for position (x, y, z)"
    )
    dimension_std: Dimensions3D = Field(
        default_factory=lambda: Dimensions3D(width=0.05, height=0.05, depth=0.05),
        description="Standard deviation estimate for dimensions"
    )
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score [0.0 - 1.0]")
    detection_source: str = Field("vision_model", description="Source (e.g. cosmos3_super_reasoner, yolo, depth_estimator)")


class SpatialRelationship(BaseModel):
    source_id: str = Field(..., description="Source object ID")
    target_id: str = Field(..., description="Target object ID")
    relation: SpatialRelationType = Field(..., description="Relationship type")
    distance_meters: Optional[float] = Field(None, description="Euclidean distance between centroids")
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    qualitative_description: Optional[str] = Field(None, description="Human readable description")


class CameraPose(BaseModel):
    position: Vector3D = Field(default_factory=lambda: Vector3D(x=0.0, y=1.6, z=3.0))
    rotation: Rotation3D = Field(default_factory=lambda: Rotation3D(x=-0.1, y=0.0, z=0.0))
    fov: float = Field(60.0, description="Field of view in degrees")
    aspect_ratio: float = Field(1.7778, description="16:9 standard aspect ratio")
    near: float = Field(0.1, description="Near clipping plane in meters")
    far: float = Field(100.0, description="Far clipping plane in meters")
    camera_height_ground: float = Field(1.6, description="Estimated camera optical height above floor")


class RoomBounds(BaseModel):
    min_point: Vector3D = Field(default_factory=lambda: Vector3D(x=-3.0, y=0.0, z=-3.0))
    max_point: Vector3D = Field(default_factory=lambda: Vector3D(x=3.0, y=2.8, z=3.0))
    room_type: str = Field("living_room", description="Detected room category")
    floor_area_sqm: float = Field(36.0, description="Calculated area in square meters")


class WallSegment2D(BaseModel):
    id: str
    start: Vector2D
    end: Vector2D
    thickness: float = 0.15
    height: float = 2.8


class DoorWindow2D(BaseModel):
    id: str
    type: str = Field("door", description="'door' or 'window'")
    wall_id: Optional[str] = None
    start: Vector2D
    end: Vector2D
    opening_width: float = 0.9


class Object2D(BaseModel):
    id: str
    name: str
    category: str
    center: Vector2D
    size: Vector2D  # width (dx), length (dy)
    rotation_deg: float = 0.0
    color: str = "#4f46e5"
    confidence: float = 0.9


class FloorPlanData(BaseModel):
    room_name: str = "Reconstructed Space"
    bounds: Dict[str, float] = Field(
        default_factory=lambda: {"min_x": -3.0, "max_x": 3.0, "min_y": -3.0, "max_y": 3.0}
    )
    area_sqm: float = 36.0
    walls: List[WallSegment2D] = Field(default_factory=list)
    openings: List[DoorWindow2D] = Field(default_factory=list)
    objects: List[Object2D] = Field(default_factory=list)
    grid_size_meters: float = 0.5


class ThreeJsMaterial(BaseModel):
    color: str = "#818cf8"
    metalness: float = 0.1
    roughness: float = 0.6
    wireframe: bool = False
    opacity: float = 1.0
    transparent: bool = False


class ThreeJsObjectNode(BaseModel):
    id: str
    name: str
    category: str
    geometry_type: str = "box"  # box, cylinder, plane, sphere, custom_mesh
    position: Vector3D
    rotation: Rotation3D
    scale: Vector3D  # width, height, depth
    material: ThreeJsMaterial
    uncertainty: UncertaintyMetrics
    bounding_box_min: Vector3D
    bounding_box_max: Vector3D
    userData: Dict[str, Any] = Field(default_factory=dict)


class ThreeJsSceneData(BaseModel):
    version: str = "1.0.0"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    camera: CameraPose
    lighting: List[Dict[str, Any]] = Field(default_factory=list)
    room_bounds: RoomBounds
    objects: List[ThreeJsObjectNode] = Field(default_factory=list)
    spatial_graph: List[SpatialRelationship] = Field(default_factory=list)


class RawDetectionInput(BaseModel):
    """Input from CV models or raw text prompt for reconstruction"""
    label: str
    box_2d: Optional[List[float]] = Field(None, description="[ymin, xmin, ymax, xmax] normalized (0 to 1)")
    estimated_distance: Optional[float] = Field(None, description="Estimated distance from camera in meters")
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SceneReconstructionRequest(BaseModel):
    room_type: str = "living_room"
    room_width: Optional[float] = 6.0
    room_length: Optional[float] = 6.0
    room_height: Optional[float] = 2.8
    detections: Optional[List[RawDetectionInput]] = None
    natural_language_description: Optional[str] = None
    use_nebius_reasoner: bool = False
