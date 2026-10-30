// ============================================================
// ThreeScene.tsx
// Three.js 3D scene renderer.
// Receives SceneData + selection state, fires callbacks on click.
// All scene → app communication is through onSelectObject.
// ============================================================

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { SceneData, SceneObject, SceneSelection } from '../../types';

// Brown palette to match overall app design
const PALETTE: Record<string, number> = {
  door:      0x8b6b4f,
  inventory: 0xb8860b,
  camera:    0x4a7c59,
  sensor:    0x6b4f35,
  vehicle:   0x9e7b5e,
  default:   0x8b6b4f,
};

const HIGHLIGHT_COLOR   = 0x6b4f35; // strong brown — selected by click
const LINKED_COLOR      = 0xb8860b; // amber — linked via evidence/timeline
const FLOOR_COLOR       = 0xf3ede4;
const GRID_COLOR        = 0xe8ddd0;
const WALL_COLOR        = 0xd4c3b0;
const ROOM_HEIGHT       = 3.5;      // metres
const UNIT              = 1;        // 1 Three.js unit = 1 metre

interface Props {
  scene: SceneData;
  selection: SceneSelection;
  onSelectObject: (obj: SceneObject | null) => void;
}

export function ThreeScene({ scene, selection, onSelectObject }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const cameraRef   = useRef<THREE.PerspectiveCamera | undefined>(undefined);
  const sceneRef    = useRef<THREE.Scene | undefined>(undefined);
  // Map from Three.js mesh uuid → SceneObject id
  const meshMapRef  = useRef<Map<string, string>>(new Map());
  // Map from SceneObject id → Three.js mesh
  const objMeshRef  = useRef<Map<string, THREE.Mesh>>(new Map());

  const rafRef      = useRef<number | undefined>(undefined);
  const mouseRef    = useRef(new THREE.Vector2());
  const raycasterRef= useRef(new THREE.Raycaster());

  // ── Orbit (simple manual camera control) ──
  const orbitRef = useRef({
    theta: Math.PI / 6,   // horizontal angle
    phi:   Math.PI / 3.5, // vertical angle
    radius: 50,
    target: new THREE.Vector3(30, 0, 20),
    dragging: false,
    lastX: 0, lastY: 0,
  });

  // ── Build scene geometry ──────────────────────────────────
  const buildScene = useCallback(() => {
    const threeScene = sceneRef.current!;

    // Clear existing objects (keep lights)
    threeScene.children
      .filter(c => c.userData['sceneBuilt'])
      .forEach(c => threeScene.remove(c));

    meshMapRef.current.clear();
    objMeshRef.current.clear();

    const rw = (scene.room_dimensions?.width  ?? 60) * UNIT;
    const rh = (scene.room_dimensions?.height ?? 40) * UNIT;

    // ── Floor ──
    const floorGeo  = new THREE.PlaneGeometry(rw, rh);
    const floorMat  = new THREE.MeshLambertMaterial({ color: FLOOR_COLOR });
    const floor     = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(rw / 2, 0, rh / 2);
    floor.receiveShadow = true;
    floor.userData['sceneBuilt'] = true;
    threeScene.add(floor);

    // ── Grid helper ──
    const grid = new THREE.GridHelper(Math.max(rw, rh), Math.max(rw, rh) / UNIT, GRID_COLOR, GRID_COLOR);
    grid.position.set(rw / 2, 0.01, rh / 2);
    grid.userData['sceneBuilt'] = true;
    threeScene.add(grid);

    // ── Walls (thin planes) ──
    const wallMat = new THREE.MeshLambertMaterial({ color: WALL_COLOR, side: THREE.FrontSide, transparent: true, opacity: 0.4 });
    const walls = [
      { w: rw, h: ROOM_HEIGHT, x: rw/2, y: ROOM_HEIGHT/2, z: 0,  rx: 0 },
      { w: rw, h: ROOM_HEIGHT, x: rw/2, y: ROOM_HEIGHT/2, z: rh, rx: Math.PI },
      { w: rh, h: ROOM_HEIGHT, x: 0,    y: ROOM_HEIGHT/2, z: rh/2, rx: -Math.PI/2, ry: Math.PI/2 },
      { w: rh, h: ROOM_HEIGHT, x: rw,   y: ROOM_HEIGHT/2, z: rh/2, rx: -Math.PI/2, ry: -Math.PI/2 },
    ];
    walls.forEach(w => {
      const geo  = new THREE.PlaneGeometry(w.w, w.h);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      if (w.rx !== undefined) mesh.rotation.x = w.rx;
      if (w.ry !== undefined) mesh.rotation.y = w.ry;
      mesh.userData['sceneBuilt'] = true;
      threeScene.add(mesh);
    });

    // ── Objects ──
    scene.objects.forEach(obj => {
      const color    = PALETTE[obj.object_type] ?? PALETTE.default;
      const ox       = obj.position.x * UNIT;
      const oz       = obj.position.y * UNIT;  // 2-D y → 3-D z
      const ow       = (obj.dimensions?.width  ?? 2) * UNIT;
      const od       = (obj.dimensions?.height ?? 2) * UNIT;
      const oh       = objectHeight(obj.object_type);

      const geo  = new THREE.BoxGeometry(ow, oh, od);
      const mat  = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: opacityFor(obj.object_type),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ox, oh / 2, oz);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.userData['sceneBuilt'] = true;
      mesh.userData['objectId'] = obj.id;

      // Edge lines
      const edges    = new THREE.EdgesGeometry(geo);
      const lineMat  = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const line     = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      // Floating label (sprite)
      const sprite = makeLabel(obj.label, color);
      sprite.position.set(0, oh / 2 + 0.6, 0);
      mesh.add(sprite);

      meshMapRef.current.set(mesh.uuid, obj.id);
      objMeshRef.current.set(obj.id, mesh);
      threeScene.add(mesh);
    });
  }, [scene]);

  // ── Apply selection colours ───────────────────────────────
  const applySelection = useCallback(() => {
    const { sceneObjectId, highlightedEvidenceIds } = selection;

    // Collect all scene object IDs that should be "linked" (amber)
    const linkedObjIds = new Set<string>();
    if (highlightedEvidenceIds.length > 0) {
      scene.objects.forEach(o => {
        if (o.evidence_ids.some(eid => highlightedEvidenceIds.includes(eid))) {
          linkedObjIds.add(o.id);
        }
      });
    }

    scene.objects.forEach(obj => {
      const mesh = objMeshRef.current.get(obj.id);
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;

      if (obj.id === sceneObjectId) {
        mat.color.setHex(HIGHLIGHT_COLOR);
        mat.opacity = 0.9;
        mat.emissive.setHex(0x3a2010);
        mesh.scale.setScalar(1.04);
      } else if (linkedObjIds.has(obj.id)) {
        mat.color.setHex(LINKED_COLOR);
        mat.opacity = 0.75;
        mat.emissive.setHex(0x2a1a00);
        mesh.scale.setScalar(1.02);
      } else {
        const base = PALETTE[obj.object_type] ?? PALETTE.default;
        mat.color.setHex(base);
        mat.opacity = opacityFor(obj.object_type);
        mat.emissive.setHex(0x000000);
        mesh.scale.setScalar(1);
      }
    });
  }, [selection, scene.objects]);

  // ── Camera position from orbit state ─────────────────────
  const updateCamera = useCallback(() => {
    const cam = cameraRef.current!;
    const o   = orbitRef.current;
    cam.position.set(
      o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
      o.radius * Math.cos(o.phi),
      o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
    );
    cam.lookAt(o.target);
  }, []);

  // ── Raycaster click → select ──────────────────────────────
  const handleClick = useCallback((e: MouseEvent) => {
    const mount = mountRef.current!;
    const rect  = mount.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
    const meshes = [...objMeshRef.current.values()];
    const hits   = raycasterRef.current.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const hit     = hits[0];
      const objId   = meshMapRef.current.get(hit.object.uuid);
      const sceneObj = scene.objects.find(o => o.id === objId) ?? null;
      onSelectObject(sceneObj);
    } else {
      onSelectObject(null);
    }
  }, [scene.objects, onSelectObject]);

  // ── Pointer events for orbit control ─────────────────────
  const onPointerDown = useCallback((e: PointerEvent) => {
    orbitRef.current.dragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const o = orbitRef.current;
    if (!o.dragging) return;
    const dx = e.clientX - o.lastX;
    const dy = e.clientY - o.lastY;
    o.theta -= dx * 0.01;
    o.phi    = Math.max(0.2, Math.min(Math.PI / 2.1, o.phi + dy * 0.01));
    o.lastX  = e.clientX;
    o.lastY  = e.clientY;
    updateCamera();
  }, [updateCamera]);

  const onPointerUp = useCallback(() => {
    orbitRef.current.dragging = false;
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    orbitRef.current.radius = Math.max(10, Math.min(120, orbitRef.current.radius + e.deltaY * 0.1));
    updateCamera();
  }, [updateCamera]);

  // ── Mount / unmount ───────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current!;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xfaf8f5, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const threeScene = new THREE.Scene();
    threeScene.fog = new THREE.Fog(0xfaf8f5, 60, 130);
    sceneRef.current = threeScene;

    // Camera
    const rw = (scene.room_dimensions?.width  ?? 60) * UNIT;
    const rh = (scene.room_dimensions?.height ?? 40) * UNIT;
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 500);
    orbitRef.current.target.set(rw / 2, 0, rh / 2);
    cameraRef.current = camera;
    updateCamera();

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    threeScene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xfff8f0, 1.2);
    dirLight.position.set(rw * 0.6, 40, rh * 0.4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far  = 200;
    dirLight.shadow.camera.left  = -80;
    dirLight.shadow.camera.right  = 80;
    dirLight.shadow.camera.top    = 80;
    dirLight.shadow.camera.bottom = -80;
    threeScene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xf0e8df, 0.4);
    fillLight.position.set(-20, 20, -20);
    threeScene.add(fillLight);

    buildScene();
    applySelection();

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(threeScene, camera);
    };
    animate();

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // Events
    mount.addEventListener('click',       handleClick);
    mount.addEventListener('pointerdown', onPointerDown);
    mount.addEventListener('pointermove', onPointerMove);
    mount.addEventListener('pointerup',   onPointerUp);
    mount.addEventListener('wheel',       onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(rafRef.current!);
      ro.disconnect();
      mount.removeEventListener('click',       handleClick);
      mount.removeEventListener('pointerdown', onPointerDown);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerup',   onPointerUp);
      mount.removeEventListener('wheel',       onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]); // re-mount only when scene data changes

  // Re-apply selection colours without rebuilding geometry
  useEffect(() => { applySelection(); }, [applySelection]);

  return (
    <div
      ref={mountRef}
      style={{ flex: 1, overflow: 'hidden', cursor: 'grab', position: 'relative' }}
      onPointerDown={() => { if (mountRef.current) mountRef.current.style.cursor = 'grabbing'; }}
      onPointerUp={()   => { if (mountRef.current) mountRef.current.style.cursor = 'grab'; }}
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────

function objectHeight(type: string): number {
  return { door: 2.5, inventory: 1.8, camera: 0.4, sensor: 0.5, vehicle: 1.6 }[type] ?? 1.2;
}

function opacityFor(type: string): number {
  return { camera: 0.7, sensor: 0.7, vehicle: 0.6 }[type] ?? 0.85;
}

/** Tiny canvas-based sprite label */
function makeLabel(text: string, color: number): THREE.Sprite {
  const canvas  = document.createElement('canvas');
  canvas.width  = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  // Background pill
  const hex = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = hex + '22';
  roundRect(ctx, 0, 0, 256, 48, 8);
  ctx.fill();

  // Text
  ctx.fillStyle = hex;
  ctx.font      = 'bold 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const display = text.length > 20 ? text.slice(0, 18) + '…' : text;
  ctx.fillText(display, 128, 24);

  const tex    = new THREE.CanvasTexture(canvas);
  const mat    = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 0.75, 1);
  return sprite;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
