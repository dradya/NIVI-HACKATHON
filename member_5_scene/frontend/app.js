/**
 * SpatialVision 3D Frontend Application
 * Interacts with FastAPI backend for 3D reconstruction, Three.js rendering,
 * SVG 2D floor plans, uncertainty bounding, and spatial reasoning.
 */

let scene, camera, renderer, controls;
let objectMeshes = [];
let uncertaintyBoxes = [];
let roomWireframe = null;
let currentSceneData = null;
let currentFloorPlan = null;
let showUncertainty = true;
let isWireframe = false;
let presetsData = {};

let activeDetections = [];

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initThreeJs();
  setupUIEventListeners();
  fetchPresets();
});

function initThreeJs() {
  const container = document.getElementById("threejs-canvas-wrapper");
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d16);

  // Camera
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 4.5, 7.5);

  // Renderer with antialiasing and shadow support
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera dipping below floor

  // Default Grid Helper
  const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Lighting
  setupLighting();

  // Raycaster for object clicking
  setupRaycaster(container);

  // Responsive resize
  window.addEventListener("resize", () => {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  animate();
}

function setupLighting() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x818cf8, 0.3);
  fillLight.position.set(-5, 4, -5);
  scene.add(fillLight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function setupRaycaster(container) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  container.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objectMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      showInspector(clickedMesh.userData);
    } else {
      hideInspector();
    }
  });
}

function showInspector(data) {
  const inspector = document.getElementById("selectedObjectInfo");
  const title = document.getElementById("inspectorTitle");
  const content = document.getElementById("inspectorContent");

  title.innerText = data.name || "Object";
  content.innerHTML = `
    <p><strong>Category:</strong> ${data.category || 'N/A'}</p>
    <p><strong>Position:</strong> (${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}, ${data.position.z.toFixed(2)})m</p>
    <p><strong>Scale:</strong> ${data.scale.x.toFixed(2)}m × ${data.scale.y.toFixed(2)}m × ${data.scale.z.toFixed(2)}m</p>
    <p><strong>Confidence:</strong> ${(data.uncertainty.confidence * 100).toFixed(1)}%</p>
    <p><strong>Position σ:</strong> ±${data.uncertainty.position_std.z.toFixed(2)}m (Z-depth)</p>
  `;
  inspector.classList.remove("hidden");
}

function hideInspector() {
  document.getElementById("selectedObjectInfo").classList.add("hidden");
}

// UI Event Handlers
function setupUIEventListeners() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active-content"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      if (tabId === "3d") document.getElementById("tabContent3D").classList.add("active-content");
      if (tabId === "2d") {
        document.getElementById("tabContent2D").classList.add("active-content");
        renderFloorPlanSVG();
      }
      if (tabId === "graph") document.getElementById("tabContentGraph").classList.add("active-content");
      if (tabId === "json") document.getElementById("tabContentJSON").classList.add("active-content");
    });
  });

  // Reconstruct Button
  document.getElementById("btnReconstruct").addEventListener("click", triggerReconstruction);

  // Preset Select
  document.getElementById("presetSelect").addEventListener("change", (e) => {
    applyPreset(e.target.value);
  });

  // Add Object
  document.getElementById("btnAddObject").addEventListener("click", () => {
    const label = prompt("Enter object label (e.g., armchair, table, lamp, plant):");
    if (label) {
      activeDetections.push({
        label: label.toLowerCase().trim(),
        box_2d: [0.4, 0.3, 0.8, 0.7],
        confidence: 0.90
      });
      renderDetectionsList();
    }
  });

  // Camera Reset
  document.getElementById("btnResetCamera").addEventListener("click", () => {
    camera.position.set(0, 4.5, 7.5);
    controls.target.set(0, 0, 0);
  });

  // Toggle Wireframe
  document.getElementById("btnToggleWireframe").addEventListener("click", () => {
    isWireframe = !isWireframe;
    objectMeshes.forEach((m) => {
      m.material.wireframe = isWireframe;
    });
  });

  // Toggle Uncertainty
  document.getElementById("btnToggleUncertainty").addEventListener("click", () => {
    showUncertainty = !showUncertainty;
    uncertaintyBoxes.forEach((box) => {
      box.visible = showUncertainty;
    });
  });

  // Copy JSON
  document.getElementById("btnCopyJSON").addEventListener("click", () => {
    const text = document.getElementById("jsonViewer").innerText;
    navigator.clipboard.writeText(text);
    alert("Three.js Scene JSON copied to clipboard!");
  });
}

async function fetchPresets() {
  try {
    const res = await fetch("/api/presets");
    presetsData = await res.json();
    applyPreset("living_room");
  } catch (err) {
    console.error("Failed to load presets", err);
  }
}

function applyPreset(key) {
  const preset = presetsData[key];
  if (!preset) return;

  document.getElementById("inpRoomW").value = preset.room_width;
  document.getElementById("inpRoomL").value = preset.room_length;
  document.getElementById("inpRoomH").value = preset.room_height;
  document.getElementById("inpScenePrompt").value = preset.prompt;

  activeDetections = JSON.parse(JSON.stringify(preset.detections));
  renderDetectionsList();
  triggerReconstruction();
}

function renderDetectionsList() {
  const container = document.getElementById("detectionsList");
  const countBadge = document.getElementById("objCountBadge");
  container.innerHTML = "";
  countBadge.innerText = activeDetections.length;

  activeDetections.forEach((det, idx) => {
    const card = document.createElement("div");
    card.className = "detection-card";
    card.innerHTML = `
      <div class="detection-info">
        <span class="det-label">${det.label}</span>
        <span class="det-conf">${(det.confidence * 100).toFixed(0)}% confidence</span>
      </div>
      <button class="btn-remove-det" onclick="removeDetection(${idx})">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

window.removeDetection = function(idx) {
  activeDetections.splice(idx, 1);
  renderDetectionsList();
};

async function triggerReconstruction() {
  const btn = document.getElementById("btnReconstruct");
  btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Reconstructing...`;
  lucide.createIcons();

  const payload = {
    room_type: document.getElementById("presetSelect").value,
    room_width: parseFloat(document.getElementById("inpRoomW").value),
    room_length: parseFloat(document.getElementById("inpRoomL").value),
    room_height: parseFloat(document.getElementById("inpRoomH").value),
    natural_language_description: document.getElementById("inpScenePrompt").value,
    use_nebius_reasoner: document.getElementById("chkUseNebius").checked,
    detections: activeDetections
  };

  try {
    const res = await fetch("/api/reconstruct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    currentSceneData = data.threejs_scene;
    currentFloorPlan = data.floor_plan;

    // Update Telemetry
    document.getElementById("txtLatency").innerText = `${data.computation_time_ms} ms`;
    document.getElementById("txtEdges").innerText = data.relationships_count;
    if (currentSceneData.camera) {
      const c = currentSceneData.camera.position;
      document.getElementById("txtCamPose").innerText = `${c.x}, ${c.y}, ${c.z}`;
    }

    // Render 3D Scene
    renderThreeJsScene(currentSceneData);

    // Update JSON viewer
    document.getElementById("jsonViewer").innerText = JSON.stringify(currentSceneData, null, 2);

    // Update Spatial Graph List
    renderSpatialGraph(currentSceneData.spatial_graph);

    // If 2D tab is visible, update it
    if (document.getElementById("tabContent2D").classList.contains("active-content")) {
      renderFloorPlanSVG();
    }

  } catch (err) {
    console.error("Reconstruction error:", err);
    alert("Reconstruction failed. Check server logs.");
  } finally {
    btn.innerHTML = `<i data-lucide="sparkles"></i> Reconstruct Scene`;
    lucide.createIcons();
  }
}

function renderThreeJsScene(sceneData) {
  // Clear previous objects
  objectMeshes.forEach((mesh) => scene.remove(mesh));
  uncertaintyBoxes.forEach((box) => scene.remove(box));
  if (roomWireframe) scene.remove(roomWireframe);

  objectMeshes = [];
  uncertaintyBoxes = [];

  // Rebuild Room Bounding Box Wireframe
  const bounds = sceneData.room_bounds;
  const rw = bounds.max_point.x - bounds.min_point.x;
  const rh = bounds.max_point.y - bounds.min_point.y;
  const rl = bounds.max_point.z - bounds.min_point.z;

  const roomGeo = new THREE.BoxGeometry(rw, rh, rl);
  const roomEdges = new THREE.EdgesGeometry(roomGeo);
  roomWireframe = new THREE.LineSegments(
    roomEdges,
    new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 })
  );
  roomWireframe.position.set(0, rh / 2, 0);
  scene.add(roomWireframe);

  // Floor Plane
  const floorGeo = new THREE.PlaneGeometry(rw, rl);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.1
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0.001;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  objectMeshes.push(floorMesh);

  // Build Objects
  sceneData.objects.forEach((node) => {
    const geo = new THREE.BoxGeometry(node.scale.x, node.scale.y, node.scale.z);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(node.material.color),
      metalness: node.material.metalness || 0.2,
      roughness: node.material.roughness || 0.5,
      wireframe: isWireframe
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(node.position.x, node.position.y, node.position.z);
    mesh.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = node;

    // Subtle edge highlight for clean architectural CAD look
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    );
    mesh.add(line);

    scene.add(mesh);
    objectMeshes.push(mesh);

    // Uncertainty Bounding Envelope (represented as translucent dashed-style outer box)
    const std = node.uncertainty.position_std;
    const uncGeo = new THREE.BoxGeometry(
      node.scale.x + std.x * 2,
      node.scale.y + std.y * 2,
      node.scale.z + std.z * 2
    );
    const uncMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      visible: showUncertainty
    });
    const uncMesh = new THREE.Mesh(uncGeo, uncMat);
    uncMesh.position.copy(mesh.position);
    scene.add(uncMesh);
    uncertaintyBoxes.push(uncMesh);
  });
}

// 2D Floor Plan SVG Renderer
function renderFloorPlanSVG() {
  if (!currentFloorPlan) return;
  const svg = document.getElementById("floorplanSvg");
  svg.innerHTML = "";

  const padding = 60;
  const svgWidth = svg.clientWidth || 800;
  const svgHeight = svg.clientHeight || 600;

  const b = currentFloorPlan.bounds;
  const roomW = b.max_x - b.min_x;
  const roomL = b.max_y - b.min_y;

  const scale = Math.min((svgWidth - padding * 2) / roomW, (svgHeight - padding * 2) / roomL);
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;

  function toSvgX(x) { return cx + x * scale; }
  function toSvgY(y) { return cy - y * scale; } // Invert Y for standard 2D Cartesian

  // Draw Grid Lines
  for (let x = b.min_x; x <= b.max_x; x += 1.0) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", toSvgX(x));
    line.setAttribute("y1", toSvgY(b.min_y));
    line.setAttribute("x2", toSvgX(x));
    line.setAttribute("y2", toSvgY(b.max_y));
    line.setAttribute("stroke", "#1e293b");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }

  for (let y = b.min_y; y <= b.max_y; y += 1.0) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", toSvgX(b.min_x));
    line.setAttribute("y1", toSvgY(y));
    line.setAttribute("x2", toSvgX(b.max_x));
    line.setAttribute("y2", toSvgY(y));
    line.setAttribute("stroke", "#1e293b");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }

  // Draw Perimeter Walls
  currentFloorPlan.walls.forEach((w) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", toSvgX(w.start.x));
    line.setAttribute("y1", toSvgY(w.start.y));
    line.setAttribute("x2", toSvgX(w.end.x));
    line.setAttribute("y2", toSvgY(w.end.y));
    line.setAttribute("stroke", "#94a3b8");
    line.setAttribute("stroke-width", "6");
    line.setAttribute("stroke-linecap", "square");
    svg.appendChild(line);
  });

  // Draw 2D Objects
  currentFloorPlan.objects.forEach((obj) => {
    const w = obj.size.x * scale;
    const h = obj.size.y * scale;
    const ox = toSvgX(obj.center.x) - w / 2;
    const oy = toSvgY(obj.center.y) - h / 2;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", ox);
    rect.setAttribute("y", oy);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("fill", obj.color || "#4f46e5");
    rect.setAttribute("fill-opacity", "0.75");
    rect.setAttribute("stroke", "#f8fafc");
    rect.setAttribute("stroke-width", "1.5");
    rect.setAttribute("rx", "4");
    g.appendChild(rect);

    // Text Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", ox + w / 2);
    text.setAttribute("y", oy + h / 2 + 4);
    text.setAttribute("fill", "#ffffff");
    text.setAttribute("font-size", "11");
    text.setAttribute("font-weight", "600");
    text.setAttribute("text-anchor", "middle");
    text.textContent = obj.name;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

// Spatial Graph & Matrix Renderer
function renderSpatialGraph(relations) {
  const container = document.getElementById("spatialRelationshipsList");
  container.innerHTML = "";

  if (!relations || relations.length === 0) {
    container.innerHTML = "<p class='text-muted'>No direct spatial edges computed.</p>";
    return;
  }

  relations.forEach((rel) => {
    const card = document.createElement("div");
    card.className = "relation-card";
    card.innerHTML = `
      <span class="relation-badge">${rel.relation}</span>
      <p><strong>${rel.qualitative_description}</strong></p>
      <div style="font-size:0.75rem; color:#94a3b8; display:flex; justify-content:space-between; margin-top:4px;">
        <span>Confidence: ${(rel.confidence * 100).toFixed(0)}%</span>
        <span>Distance: ${rel.distance_meters ? rel.distance_meters + 'm' : 'N/A'}</span>
      </div>
    `;
    container.appendChild(card);
  });
}
