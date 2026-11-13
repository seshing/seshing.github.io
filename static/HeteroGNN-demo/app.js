import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const TYPES = {
  building: { name: 'Building', color: '#2875ab', level: 115 },
  street: { name: 'Street', color: '#eaa337', level: 4 },
  intersection: { name: 'Intersection', color: '#bc5145', level: 4 },
  plot: { name: 'Urban plot', color: '#7a59a4', level: 230 }
};
const STAGES = ['City model', 'Exploded layers', 'Urban graph', 'Message passing'];
const NEXT = ['Explode', 'Build graph', 'Propagate', 'Restart'];
const GRAPH_STEPS = ['Generate nodes', 'Within-layer connections', 'Cross-layer connections'];
const GRAPH_DURATIONS = [2.6, 4.2, 4.2];
const PROPAGATE_DURATIONS = [0, 5.5, 5.5], PREDICTION_FADE = 2;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleCase = value => String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

let data, basemap, renderer, scene, camera, controls, baseCity;
let stage = 0, target, inspected, playing = false, flowPaused = false, flowTime = 0, stageTime = 0;
let graphStep = 0, graphTime = 0, nodeTime = 0;
let propagateStep = 0;
let loopPropagation = false;
let predictionShown = false, revealTime = 0;
const graphEdgeCounts = [0, 0, 0];
let span = 600, radius = 280, zoomGoal = 1, lastFrame = performance.now();
const nodes = new Map(), layers = new Map(), nodeButtons = new Map(), nodeDiscs = new Map(), geometries = [], edges = [];
const basemapMaterials = [];
const layerTags = [], selection = new Set(), activeIntra = new Set(), activeCross = new Set();
const viewGoal = new THREE.Vector3(), projected = new THREE.Vector3();
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let pointerDown;

function shapes(geometry) {
  if (!geometry) return [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.filter(p => p[0]?.length > 2).map(rings => {
    const shape = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  });
}

function polygonMesh(node, group, color, height = 1, opacity = 1, outline = false) {
  for (const shape of shapes(node.geometry)) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    const Material = group === baseCity ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
    const material = new Material({ color, transparent: true, opacity, depthWrite: opacity > .5 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.nodeId = node.id;
    mesh.castShadow = group === baseCity;
    mesh.receiveShadow = true;
    group.add(mesh);
    geometries.push({ mesh, node, base: group === baseCity, opacity });
    if (outline) {
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: '#8f9ba4', transparent: true, opacity: .2 }));
      group.add(edge);
      geometries.push({ mesh: edge, node, base: group === baseCity, opacity: .2 });
    }
  }
}

function makeStreet(node, group) {
  const lines = node.geometry?.type === 'LineString' ? [node.geometry.coordinates] : node.geometry?.type === 'MultiLineString' ? node.geometry.coordinates : [];
  for (const line of lines) {
    const vertices = [], indices = [], halfWidth = 1.25;
    line.forEach(([x, y], i) => {
      const previous = line[Math.max(0, i - 1)], next = line[Math.min(line.length - 1, i + 1)];
      const dx = next[0] - previous[0], dz = previous[1] - next[1], length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length * halfWidth, nz = dx / length * halfWidth;
      vertices.push(x + nx, 1, -y + nz, x - nx, 1, -y - nz);
      if (i) indices.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2, i * 2 - 1, i * 2 + 1);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: TYPES.street.color, transparent: true, opacity: .65, side: THREE.DoubleSide }));
    group.add(mesh);
    geometries.push({ mesh, node, base: false, opacity: .65 });
  }
}

async function createBasemap() {
  const loader = new THREE.TextureLoader();
  $('scene').setAttribute('aria-busy', 'true');
  const loaded = await Promise.allSettled(basemap.tiles.map(async tile => {
    const texture = await loader.loadAsync(tile.url);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(tile.corners.flatMap(([x, y]) => [x, -3, -y]), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uOffset: { value: new THREE.Vector2(tile.column, basemap.rows - 1 - tile.row) },
        uSize: { value: new THREE.Vector2(basemap.columns, basemap.rows) },
        uOpacity: { value: stage >= 2 ? .13 : .28 }
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D uMap; uniform vec2 uOffset; uniform vec2 uSize; uniform float uOpacity; void main(){vec3 color=texture2D(uMap,vUv).rgb;float grey=dot(color,vec3(.299,.587,.114));vec2 uv=(uOffset+vUv)/uSize;float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));gl_FragColor=vec4(mix(color,vec3(grey),.9),uOpacity*smoothstep(0.0,.22,edge));}',
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    basemapMaterials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -5;
    scene.add(mesh);
  }));
  $('scene').setAttribute('aria-busy', 'false');
  $('map-status').hidden = loaded.every(result => result.status === 'fulfilled');
}

function point(node, final = false) {
  const height = final ? TYPES[node.type].level : layers.get(node.type)?.position.y || 0;
  return new THREE.Vector3(node.position[0], height + 2, -node.position[1]);
}

function addNodeDisc(node) {
  const group = new THREE.Group();
  group.position.set(node.position[0], 2, -node.position[1]);
  const material = new THREE.MeshBasicMaterial({ color: TYPES[node.type].color, transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.5, 32), material);
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 8;
  const outline = new THREE.Mesh(new THREE.CircleGeometry(4.4, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide }));
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = -.02;
  outline.renderOrder = 7;
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6, 40), new THREE.MeshBasicMaterial({ color: TYPES[node.type].color, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 6;
  ring.visible = false;
  group.add(outline, disc, ring);
  if (node.photo) {
    const photoMark = new THREE.Mesh(new THREE.CircleGeometry(.65, 16), material);
    photoMark.rotation.x = -Math.PI / 2;
    photoMark.position.set(4.4, .05, 4.4);
    photoMark.renderOrder = 8;
    group.add(photoMark);
  }
  group.visible = false;
  layers.get(node.type).add(group);
  nodeDiscs.set(node.id, { group, disc, outline, ring, delay: nodeDiscs.size / Math.max(1, data.nodes.length - 1) * 1.25 });
}

function addNodeButton(node) {
  const button = document.createElement('button');
  button.className = 'node-hit';
  button.style.setProperty('--node-color', TYPES[node.type].color);
  button.innerHTML = '<i></i>';
  button.dataset.node = node.id;
  button.setAttribute('aria-label', `Select ${TYPES[node.type].name.toLowerCase()} ${node.label || node.id}${node.photo ? ', photograph available' : ''}`);
  button.classList.toggle('has-photo', !!node.photo);
  button.addEventListener('click', () => {
    if (node.type === 'building' && node.prediction) chooseTarget(node);
    inspect(node);
  });
  button.addEventListener('mouseenter', () => {
    $('tooltip').textContent = `${TYPES[node.type].name} · ${node.label || node.id}`;
    $('tooltip').hidden = false;
  });
  button.addEventListener('mouseleave', () => $('tooltip').hidden = true);
  $('node-labels').append(button);
  nodeButtons.set(node.id, button);
}

function createCity() {
  const positions = data.nodes.flatMap(n => [Math.abs(n.position[0]), Math.abs(n.position[1])]);
  radius = Math.max(190, ...positions) * 1.13;
  baseCity = new THREE.Group();
  scene.add(baseCity);
  for (const type of Object.keys(TYPES)) {
    const layer = new THREE.Group();
    layers.set(type, layer);
    scene.add(layer);
  }
  for (const node of data.nodes) {
    nodes.set(node.id, node);
    if (node.type === 'building') {
      polygonMesh(node, baseCity, '#c1cdd5', node.height > 0 ? node.height : 16, 1, true);
      polygonMesh(node, layers.get('building'), '#7faecb', 1.5, .46, false);
    } else if (node.type === 'plot') polygonMesh(node, layers.get('plot'), '#b1a0c8', 1, .32);
    else if (node.type === 'street') makeStreet(node, layers.get('street'));
    addNodeDisc(node);
    addNodeButton(node);
  }
  const labels = [
    ['plot', 'Urban plot', '03'], ['building', 'Building', '02'],
    ['street', 'Street &<br><span class="intersection-label">Intersection</span>', '01']
  ];
  for (const [type, text, number] of labels) {
    const element = document.createElement('div');
    element.className = 'layer-label';
    element.style.setProperty('--layer-color', TYPES[type].color);
    element.innerHTML = `<span><small>${number}</small>${text}</span>`;
    $('layer-labels').append(element);
    const coordinates = data.nodes.filter(node => node.type === type).flatMap(node => node.geometry?.coordinates.flat(Infinity) || []);
    layerTags.push({ type, element, coordinates });
  }
  span = radius * 1.68;
  for (const type of Object.keys(TYPES)) $(`count-${type}`).textContent = data.nodes.filter(n => n.type === type).length;
}

function flowMaterial(start, end, opacity = .85) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStart: { value: new THREE.Color(start) }, uEnd: { value: new THREE.Color(end) }, uOpacity: { value: opacity } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform float uTime; uniform vec3 uStart; uniform vec3 uEnd; uniform float uOpacity; void main(){float p=fract(uTime*.28)*1.55-.28;float glow=exp(-pow((vUv.x-p)/.17,2.0));vec3 color=mix(uStart,uEnd,vUv.x);gl_FragColor=vec4(mix(color,vec3(1.0),glow*.22),glow*uOpacity);}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
}

function makeCurve(edge, reverse = false) {
  const a = nodes.get(reverse ? edge.target : edge.source), b = nodes.get(reverse ? edge.source : edge.target);
  const start = point(a, true), end = point(b, true);
  if (TYPES[a.type].level !== TYPES[b.type].level) return { curve: new THREE.LineCurve3(start, end), a, b };
  const midpoint = start.clone().add(end).multiplyScalar(.5);
  midpoint.y = Math.max(start.y, end.y) + Math.min(130, 35 + start.distanceTo(end) * .23);
  return { curve: new THREE.QuadraticBezierCurve3(start, midpoint, end), a, b };
}

function edgeGeometry(curve, width, a, b) {
  const geometry = new THREE.TubeGeometry(curve, 28, width, 6, false);
  const start = new THREE.Color(TYPES[a.type].color), end = new THREE.Color(TYPES[b.type].color);
  const uv = geometry.getAttribute('uv'), colors = [];
  for (let i = 0; i < uv.count; i++) {
    const color = start.clone().lerp(end, uv.getX(i));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function buildEdges() {
  for (const record of edges) {
    scene.remove(record.group);
    const oldGeometry = new Set([record.thinGeometry, record.focusGeometry]);
    record.group.traverse(o => { if (o.geometry) oldGeometry.add(o.geometry); o.material?.dispose(); });
    oldGeometry.forEach(geometry => geometry.dispose());
  }
  edges.length = 0;
  graphEdgeCounts.fill(0);
  for (const edge of data.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    const { curve, a, b } = makeCurve(edge);
    const group = new THREE.Group();
    const thinGeometry = edgeGeometry(curve, .32, a, b);
    const focusGeometry = edgeGeometry(curve, .55, a, b);
    const base = new THREE.Mesh(thinGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .12, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 38, .48, 5, false), flowMaterial(TYPES[a.type].color, TYPES[b.type].color));
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 38, 1.2, 5, false), flowMaterial(TYPES[a.type].color, TYPES[b.type].color, .13));
    group.add(base, glow, halo);
    glow.visible = halo.visible = false;
    scene.add(group);
    const graphPhase = TYPES[nodes.get(edge.source).type].level === TYPES[nodes.get(edge.target).type].level ? 1 : 2;
    edges.push({ ...edge, group, base, glow, halo, thinGeometry, focusGeometry, graphPhase, revealIndex: graphEdgeCounts[graphPhase]++, reversed: false });
  }
}

function neighborhood() {
  selection.clear(); activeIntra.clear(); activeCross.clear();
  if (!target) return;
  selection.add(target.id);
  const contextual = new Set();
  for (const edge of edges) {
    if (edge.source !== target.id && edge.target !== target.id) continue;
    const neighbor = edge.source === target.id ? edge.target : edge.source;
    selection.add(neighbor);
    if (edge.relation === 'building-building') activeIntra.add(edge.id);
    if (['building-street', 'building-plot'].includes(edge.relation)) {
      activeCross.add(edge.id); contextual.add(neighbor);
    }
  }
  for (const edge of edges) {
    if (!contextual.has(edge.source) && !contextual.has(edge.target)) continue;
    if (!['plot-plot', 'street-intersection'].includes(edge.relation)) continue;
    activeIntra.add(edge.id); selection.add(edge.source); selection.add(edge.target);
  }
  for (const edge of edges) {
    // Curves point toward the recipient in this local message-passing illustration.
    const reverse = edge.source === target.id || (contextual.has(edge.source) && !contextual.has(edge.target));
    if (reverse === edge.reversed) continue;
    const { curve, a, b } = makeCurve(edge, reverse);
    edge.thinGeometry.dispose(); edge.focusGeometry.dispose();
    edge.thinGeometry = edgeGeometry(curve, .32, a, b);
    edge.focusGeometry = edgeGeometry(curve, .55, a, b);
    edge.base.geometry = edge.thinGeometry;
    for (const [mesh, width, segments] of [[edge.glow, .48, 38], [edge.halo, 1.2, 38]]) {
      mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(curve, segments, width, 5, false);
    }
    for (const mesh of [edge.glow, edge.halo]) {
      mesh.material.uniforms.uStart.value.set(TYPES[a.type].color);
      mesh.material.uniforms.uEnd.value.set(TYPES[b.type].color);
    }
    edge.reversed = reverse;
  }
}

function chooseTarget(node) {
  if (node.type !== 'building' || !node.prediction) return;
  if (node.id === target?.id) return;
  target = node; flowTime = 0; predictionShown = false; revealTime = 0;
  if (stage === 3) setPropagateStep(0);
  updatePlayButton();
  neighborhood();
  for (const [id, button] of nodeButtons) button.classList.toggle('is-target', id === target.id);
}

function metricHTML(metric) {
  const precision = Math.abs(metric.value) > 0 && Math.abs(metric.value) < .01 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: Math.abs(metric.value) < 1 ? 3 : 2 };
  const value = typeof metric.value === 'number' ? new Intl.NumberFormat('en', precision).format(metric.value) : metric.value;
  return `<div title="${escape(metric.source || '')}"><dt>${escape(metric.name)}</dt><dd>${escape(value)}${metric.unit && metric.unit !== '–' && metric.unit !== '-' ? `<small>${escape(metric.unit)}</small>` : ''}</dd></div>`;
}

function renderPrediction(node) {
  if (node.type !== 'building') { $('prediction').innerHTML = ''; return; }
  if (!node.prediction) { $('prediction').innerHTML = '<p class="prediction-unknown">No saved prediction for this building.</p>'; return; }
  if (stage !== 3 || !predictionShown || node.id !== target?.id) {
    $('prediction').innerHTML = '<div class="prediction-locked"><svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>Prediction hidden</div>';
  } else {
    const p = node.prediction;
    $('prediction').innerHTML = `<div class="prediction-results prediction-reveal"><div><small>TOP-1</small><strong>${escape(titleCase(p.top1))}</strong></div><div><small>TOP-2</small><strong>${escape(titleCase(p.top2))}</strong></div></div>`;
  }
}

function inspect(node) {
  inspected = node;
  $('inspector').hidden = false;
  $('about-panel').hidden = true;
  $('about-button').setAttribute('aria-expanded', 'false');
  $('node-kind').textContent = TYPES[node.type].name;
  $('node-kind').style.setProperty('--node-color', TYPES[node.type].color);
  $('node-title').textContent = node.label || node.id;
  $('photo-wrap').hidden = node.type !== 'building';
  $('building-photo').hidden = !node.photo;
  $('street-unavailable').hidden = !!node.photo;
  $('photo-credit').hidden = !node.photo;
  if (node.photo) {
    $('building-photo').src = node.photo.src + (node.photo.sha256 ? '?v=' + node.photo.sha256.slice(0, 10) : '');
    $('building-photo').alt = `Street-level photograph of ${node.label || node.id} in Washington, D.C.`;
    $('photo-credit').innerHTML = `© ${escape(node.photo.credit || 'Mapillary contributors')}${node.photo.capturedAt ? ' · ' + escape(node.photo.capturedAt) : ''}${node.photo.sourceUrl ? ` · <a href="${escape(node.photo.sourceUrl)}" target="_blank" rel="noopener">Source ↗</a>` : ''}`;
  } else $('building-photo').removeAttribute('src');
  $('satellite-photo').hidden = !node.satellite;
  $('satellite-unavailable').hidden = !!node.satellite;
  $('satellite-credit').hidden = !node.satellite;
  if (node.satellite) {
    $('satellite-photo').src = node.satellite.src + '?v=' + node.satellite.sha256.slice(0, 10);
    $('satellite-photo').alt = `Satellite crop of ${node.label || node.id} in Washington, D.C.`;
    $('satellite-credit').textContent = node.satellite.credit;
  } else $('satellite-photo').removeAttribute('src');
  const metrics = (node.metrics || []).filter(m => m.value !== null && m.value !== undefined);
  $('metrics').innerHTML = metrics.slice(0, 6).map(metricHTML).join('');
  $('extra-metrics').innerHTML = metrics.slice(6).map(metricHTML).join('');
  $('more-metrics').hidden = metrics.length <= 6;
  $('more-metrics').open = false;
  $('node-note').textContent = node.metricsNote || (node.type === 'building' || node.type === 'plot' ? 'Morphology measured from the source geometry.' : 'Network indicators retained from the full city graph.');
  if (node.type === 'building' && !node.photo) $('node-note').textContent += ' No suitable street photograph in this sample.';
  renderPrediction(node);
  for (const [id, button] of nodeButtons) button.classList.toggle('is-selected', id === node.id);
  frameCamera();
}

function closeInspector() {
  $('inspector').hidden = true;
  inspected = null;
  for (const button of nodeButtons.values()) button.classList.remove('is-selected');
  frameCamera();
}

function setPlaying(value) {
  playing = value;
  flowPaused = !value;
  updatePlayButton();
}

function playbackRunning() {
  return playing || (!flowPaused && ((stage === 2 && graphTime < GRAPH_DURATIONS[graphStep]) || (stage === 3 && propagateStep > 0)));
}

function updatePlayButton() {
  const running = playbackRunning();
  if ($('play').getAttribute('aria-pressed') === String(running)) return;
  $('play').setAttribute('aria-label', running ? 'Pause demonstration' : 'Play demonstration');
  $('play').setAttribute('aria-pressed', String(running));
  $('play-icon').innerHTML = running ? '<path d="M7 6h3v12H7Zm7 0h3v12h-3Z"/>' : '<path d="m9 6 9 6-9 6Z"/>';
}

function updateGraphNavigation() {
  $('graph-steps').hidden = stage < 2;
  $('graph-steps').setAttribute('aria-label', stage === 3 ? 'Propagation steps' : 'Graph construction steps');
  $('phase-note').hidden = stage >= 2;
  $('app').dataset.graphStep = String(graphStep);
  $('app').dataset.propagateStep = String(propagateStep);
  const step = stage === 3 ? propagateStep : graphStep;
  for (const button of document.querySelectorAll('button[data-graph-step]')) {
    button.hidden = stage === 3 && button.dataset.graphStep === '0';
    button.setAttribute('aria-pressed', String(+button.dataset.graphStep === step));
  }
  $('nodes-step-separator').hidden = stage === 3;
  const label = stage >= 2 ? ['Within layers', 'Across layers', stage === 3 ? 'Restart' : 'Propagate'][step] : NEXT[stage];
  $('next').textContent = label;
  $('next').setAttribute('aria-label', label === 'Restart' ? 'Restart demonstration' : label);
}

function setGraphStep(next, fromPlay = false) {
  if (stage !== 2 || !Number.isInteger(next) || next < 0 || next > 2) throw Error('Unknown graph construction step');
  graphStep = next; graphTime = 0;
  nodeTime = next === 0 ? 0 : 2.1;
  if (!fromPlay) { setPlaying(false); flowPaused = false; }
  updateGraphNavigation(); updatePlayButton();
}

function setPropagateStep(next, fromPlay = false) {
  if (stage !== 3 || !Number.isInteger(next) || next < 0 || next > 2) throw Error('Unknown propagation step');
  propagateStep = next; flowTime = 0; predictionShown = false; revealTime = 0;
  loopPropagation = !fromPlay && next > 0;
  if (!fromPlay) { setPlaying(false); flowPaused = next === 0; }
  if (inspected) renderPrediction(inspected);
  updateGraphNavigation(); updatePlayButton();
}

function nextStep(fromPlay = false) {
  if (stage === 2 && graphStep < 2) setGraphStep(graphStep + 1, fromPlay);
  else if (stage === 3 && propagateStep < 2) setPropagateStep(propagateStep + 1, fromPlay);
  else setStage(stage === 3 ? 0 : stage + 1, fromPlay);
}

function setStage(next, fromPlay = false) {
  if (!Number.isInteger(next) || next < 0 || next > 3) throw Error('Unknown demonstration stage');
  stage = next; stageTime = 0; flowTime = 0; predictionShown = false; revealTime = 0; loopPropagation = false;
  if (stage === 2) { graphStep = 0; graphTime = 0; nodeTime = 0; }
  if (stage === 3) propagateStep = 0;
  if (!fromPlay) { setPlaying(false); flowPaused = stage === 3; }
  updatePlayButton();
  $('previous').disabled = stage === 0;
  updateGraphNavigation();
  for (const button of document.querySelectorAll('[data-stage]')) {
    if (+button.dataset.stage === stage) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  $('legend').hidden = stage < 2;
  if (stage === 0) closeInspector();
  if (inspected) renderPrediction(inspected);
  $('phase-note').textContent = ['An urban graph, unfolded.', 'Three layers. Four kinds of urban context.', 'Select a node to explore its features.', 'Same-type aggregation'][stage];
  neighborhood();
  frameCamera();
}

function frameCamera() {
  if (!camera) return;
  $('app').style.setProperty('--bottom-controls-height', `${document.querySelector('.bottom-ui').offsetHeight}px`);
  const w = innerWidth, h = innerHeight;
  const open = !$('inspector').hidden;
  const shift = (open && w >= 700 ? $('inspector').offsetWidth / 2 + 12 : 0) - Math.min(80, w * .05);
  const shiftY = open && w < 700 ? h * .18 : 0;
  camera.left = -span * w / h / 2;
  camera.right = span * w / h / 2;
  camera.top = span / 2; camera.bottom = -span / 2;
  camera.setViewOffset(w, h, shift, shiftY, w, h);
  camera.updateProjectionMatrix();
  viewGoal.set(0, stage > 0 ? 105 : 0, 0);
  zoomGoal = Math.min(stage > 0 ? .77 : 1.03, .72 * w / h);
  if (open && w >= 700) zoomGoal = Math.min(zoomGoal, .72 * (w - $('inspector').offsetWidth - 64) / h);
  if (stage >= 3 && target && selection.size) {
    // Fit the selected message-passing neighborhood, including the same-layer arcs.
    const positions = [...selection].map(id => point(nodes.get(id), true));
    for (const edge of edges) if (activeIntra.has(edge.id) || activeCross.has(edge.id)) positions.push(...makeCurve(edge, edge.reversed).curve.getPoints(12));
    viewGoal.copy(new THREE.Box3().setFromPoints(positions).getCenter(new THREE.Vector3()));
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const xs = positions.map(p => p.clone().sub(viewGoal).dot(right));
    const ys = positions.map(p => p.clone().sub(viewGoal).dot(up));
    viewGoal.addScaledVector(right, (Math.min(...xs) + Math.max(...xs)) / 2);
    viewGoal.addScaledVector(up, (Math.min(...ys) + Math.max(...ys)) / 2);
    const availableWidth = Math.max(160, w - (open && w >= 700 ? $('inspector').offsetWidth + 72 : 48) - 55);
    const bottomControls = Math.max(170, document.querySelector('.bottom-ui').offsetHeight + 85);
    const bottomSpace = open && w < 700 ? $('inspector').offsetHeight + bottomControls : bottomControls;
    const topSpace = 140;
    const availableHeight = Math.max(120, h - topSpace - bottomSpace);
    const width = Math.max(...xs) - Math.min(...xs) + 65;
    const height = Math.max(...ys) - Math.min(...ys) + 65;
    zoomGoal = Math.min(3, span * availableWidth / h / width, span * availableHeight / h / height) * .9;
    camera.setViewOffset(w, h, shift, (bottomSpace - topSpace) / 2, w, h);
    camera.updateProjectionMatrix();
  }
}

function setUpScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f7f7');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  $('scene').append(renderer.domElement);
  camera = new THREE.OrthographicCamera(-500, 500, 300, -300, 1, 5000);
  camera.position.set(560, 650, 850);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI / 2.1;
  controls.minZoom = .08; controls.maxZoom = 4;
  controls.enablePan = false;
  controls.addEventListener('start', () => { $('tooltip').hidden = true; });
  // Keep an explicit user zoom instead of continuously restoring the stage's zoom.
  renderer.domElement.addEventListener('wheel', () => { zoomGoal = null; }, { passive: true });
  renderer.domElement.addEventListener('touchstart', () => { zoomGoal = null; }, { passive: true });
  scene.add(new THREE.AmbientLight('#ffffff', 1.35));
  const sunlight = new THREE.DirectionalLight('#ffffff', 1.45);
  sunlight.position.set(-250, 750, 300);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 1, far: 1600 });
  sunlight.shadow.bias = -.001;
  sunlight.shadow.normalBias = 1;
  scene.add(sunlight);
  createCity();
  createBasemap().catch(error => { $('scene').setAttribute('aria-busy', 'false'); $('map-status').hidden = false; console.warn('Basemap could not be loaded.', error); });
  buildEdges();
  chooseTarget(nodes.get(data.meta.defaultTarget) || data.nodes.find(n => n.type === 'building' && n.photo && n.prediction) || data.nodes.find(n => n.type === 'building' && n.prediction));
  frameCamera();
  camera.zoom = zoomGoal;
  camera.updateProjectionMatrix();
  renderer.domElement.addEventListener('pointerdown', event => pointerDown = [event.clientX, event.clientY]);
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
    pointer.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(baseCity.children).find(h => h.object.userData.nodeId);
    if (!hit) return;
    const node = nodes.get(hit.object.userData.nodeId);
    if (node.prediction) chooseTarget(node);
    inspect(node);
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); frameCamera(); });
  renderer.setAnimationLoop(render);
}

function updateLabels() {
  const focusing = stage >= 3;
  const generating = stage === 2 && !reducedMotion && nodeTime < 1.85;
  if ($('node-labels').getAttribute('aria-busy') !== String(generating)) $('node-labels').setAttribute('aria-busy', String(generating));
  const overviewZoom = Math.min(.77, .72 * innerWidth / innerHeight);
  const markerRadius = focusing ? THREE.MathUtils.clamp(4.6 * Math.sqrt(camera.zoom / overviewZoom), 4.6, 9) : 4.6;
  const markerSize = markerRadius / 3.5 * (camera.top - camera.bottom) / (camera.zoom * innerHeight);
  for (const [id, button] of nodeButtons) {
    const node = nodes.get(id);
    const marker = nodeDiscs.get(id);
    const progress = stage === 2 && !reducedMotion ? THREE.MathUtils.clamp((nodeTime - marker.delay) / .6, 0, 1) : 1;
    const appearance = progress * progress * (3 - 2 * progress);
    marker.group.visible = stage >= 2 && appearance > 0;
    const related = !focusing || selection.has(id);
    const markerScale = markerSize * (related ? 1 : .42) * (.25 + .75 * appearance);
    marker.group.scale.lerp(new THREE.Vector3(markerScale, markerScale, markerScale), reducedMotion ? 1 : .18);
    marker.disc.material.opacity = (related ? .95 : .72) * appearance;
    marker.outline.material.opacity = (related ? .95 : .4) * appearance;
    marker.ring.material.opacity = .4 * appearance;
    marker.disc.scale.setScalar(id === target?.id ? 1.18 : 1);
    marker.outline.scale.copy(marker.disc.scale);
    marker.ring.visible = id === target?.id || id === inspected?.id || button === document.activeElement;
    if (stage < 2 && node.type !== 'building') { button.hidden = true; continue; }
    projected.copy(point(node)).project(camera);
    const x = (projected.x + 1) * innerWidth / 2, y = (-projected.y + 1) * innerHeight / 2;
    button.hidden = appearance < .08 || projected.z < -1 || projected.z > 1 || x < -20 || x > innerWidth + 20 || y < -20 || y > innerHeight + 20;
    button.style.left = `${x}px`; button.style.top = `${y}px`;
    button.classList.toggle('city-node', stage < 2);
    button.classList.toggle('dimmed', focusing && !selection.has(id));
    if (button.matches(':hover')) {
      $('tooltip').style.left = `${Math.min(innerWidth - 190, x + 12)}px`;
      $('tooltip').style.top = `${y - 29}px`;
    }
  }
  for (const { type, element, coordinates } of layerTags) {
    element.hidden = stage === 0;
    const height = layers.get(type).position.y + 3;
    let left = innerWidth, labelY = 0;
    for (let i = 0; i < coordinates.length; i += 2) {
      projected.set(coordinates[i], height, -coordinates[i + 1]).project(camera);
      const x = (projected.x + 1) * innerWidth / 2;
      if (x < left) { left = x; labelY = (-projected.y + 1) * innerHeight / 2; }
    }
    element.style.left = `${Math.max(element.offsetWidth + 20, Math.min(left - 8, innerWidth - 20))}px`;
    element.style.top = `${labelY}px`;
  }
  $('prediction-label').hidden = stage !== 3 || !predictionShown || !target?.prediction;
  $('prediction-label').style.opacity = String(reducedMotion ? 1 : Math.min(1, revealTime / PREDICTION_FADE));
  if (stage === 3 && predictionShown && target?.prediction) {
    projected.copy(point(target)).project(camera);
    $('prediction-label').textContent = `Predict: ${titleCase(target.prediction.top1)}`;
    $('prediction-label').style.left = `${(projected.x + 1) * innerWidth / 2 + 16}px`;
    $('prediction-label').style.top = `${(-projected.y + 1) * innerHeight / 2 - 17}px`;
  }
}

function render(time) {
  const elapsed = Math.min((time - lastFrame) / 1000, 1);
  const dt = Math.min(elapsed, .08); lastFrame = time;
  const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
  const delta = viewGoal.clone().sub(controls.target).multiplyScalar(ease);
  controls.target.add(delta); camera.position.add(delta);
  if (zoomGoal !== null) camera.zoom += (zoomGoal - camera.zoom) * ease;
  camera.updateProjectionMatrix();
  for (const [type, layer] of layers) layer.position.y += ((stage > 0 ? TYPES[type].level : 0) - layer.position.y) * ease;
  for (const material of basemapMaterials) material.uniforms.uOpacity.value += ((stage >= 2 ? .13 : .28) - material.uniforms.uOpacity.value) * ease;
  for (const { mesh, node, base, opacity } of geometries) {
    const focused = stage < 3 || selection.has(node.id);
    const layerOpacity = stage === 1 ? (node.type === 'building' ? .64 : node.type === 'plot' ? .54 : .8) : opacity * .65;
    let goal = base ? (stage > 0 ? (stage === 1 ? .24 : .16) : opacity) : (stage === 0 ? (node.type === 'street' ? .2 : 0) : layerOpacity * (focused ? 1 : .35));
    if (base && mesh.isLineSegments) goal *= .65;
    mesh.material.opacity += (goal - mesh.material.opacity) * ease;
    mesh.material.depthWrite = mesh.material.opacity > .5;
    if (base && mesh.isMesh) mesh.castShadow = stage === 0;
    mesh.visible = mesh.material.opacity > .005;
  }
  if (!flowPaused && stage === 3) {
    flowTime = loopPropagation ? flowTime + elapsed : Math.min(PROPAGATE_DURATIONS[propagateStep], flowTime + elapsed);
    if (!loopPropagation && flowTime >= PROPAGATE_DURATIONS[propagateStep]) {
      if (propagateStep < 2 && playing) setPropagateStep(propagateStep + 1, true);
      else if (propagateStep === 1) setPlaying(false);
      else if (propagateStep === 2) {
        if (!predictionShown) {
          predictionShown = true;
          if (inspected) renderPrediction(inspected);
        }
        revealTime = Math.min(PREDICTION_FADE, revealTime + elapsed);
        if (revealTime >= PREDICTION_FADE) setPlaying(false);
      }
    }
  }
  if (!flowPaused && stage === 2) {
    graphTime = Math.min(GRAPH_DURATIONS[graphStep], graphTime + elapsed);
    nodeTime = Math.min(2.1, nodeTime + elapsed);
    updatePlayButton();
  }
  if (playing) {
    stageTime += elapsed;
    const duration = [1, 2.8][stage];
    if (stage === 2) { if (graphTime >= GRAPH_DURATIONS[graphStep]) nextStep(true); }
    else if (stage < 2 && stageTime >= duration) setStage(stage + 1, true);
  }
  const phase = propagateStep - 1;
  for (const edge of edges) {
    const intra = activeIntra.has(edge.id), cross = activeCross.has(edge.id);
    const revealDelay = edge.revealIndex / Math.max(1, graphEdgeCounts[edge.graphPhase]) * 1.05;
    const edgeProgress = stage === 2 ? (graphStep === edge.graphPhase ? (reducedMotion ? 1 : THREE.MathUtils.clamp((graphTime - revealDelay) / .7, 0, 1)) : 0) : 1;
    edge.group.visible = stage >= 2 && edgeProgress > 0;
    edge.base.geometry = stage >= 3 && (intra || cross) ? edge.focusGeometry : edge.thinGeometry;
    edge.base.geometry.setDrawRange(0, stage === 2 ? Math.ceil(edgeProgress * 28) * 36 : Infinity);
    const active = stage === 3 && phase >= 0 && !predictionShown && (phase === 0 ? intra : cross);
    edge.base.material.opacity = stage < 3 ? .24 * edgeProgress : active ? .52 : (intra || cross) ? .17 : .035;
    edge.glow.visible = edge.halo.visible = active && !flowPaused && !reducedMotion;
    edge.glow.material.uniforms.uTime.value = flowTime;
    edge.halo.material.uniforms.uTime.value = flowTime;
  }
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

function registerTools() {
  if (!document.modelContext?.registerTool) return;
  const register = tool => Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
  register({ name: 'hetero_set_stage', description: 'Navigate to a stage: 0 city, 1 exploded layers, 2 graph, 3 propagation followed by the real saved prediction.', inputSchema: { type: 'object', properties: { stage: { type: 'integer', minimum: 0, maximum: 3 } }, required: ['stage'], additionalProperties: false }, execute: input => { setStage(input.stage); return { stage: STAGES[stage], target: target?.id }; } });
  register({ name: 'hetero_set_graph_step', description: 'Build the displayed graph step by step: 0 generate nodes, 1 connect within layers, 2 connect across layers.', inputSchema: { type: 'object', properties: { step: { type: 'integer', minimum: 0, maximum: 2 } }, required: ['step'], additionalProperties: false }, execute: input => { if (stage !== 2) setStage(2); setGraphStep(input.step); return { step: GRAPH_STEPS[graphStep] }; } });
  register({ name: 'hetero_set_propagate_step', description: 'Select propagation: 0 shows static connections, 1 loops within layers, 2 loops across layers. Manual selection stays on that step; play/pause controls its loop.', inputSchema: { type: 'object', properties: { step: { type: 'integer', minimum: 0, maximum: 2 } }, required: ['step'], additionalProperties: false }, execute: input => { if (stage !== 3) setStage(3); setPropagateStep(input.step); return { step: propagateStep === 0 ? 'Static connections' : GRAPH_STEPS[propagateStep] }; } });
  register({ name: 'hetero_select_node', description: 'Inspect a displayed urban node. Selecting a building also focuses its message-passing neighborhood.', inputSchema: { type: 'object', properties: { id: { type: 'string', enum: data.nodes.map(n => n.id) } }, required: ['id'], additionalProperties: false }, execute: input => { const node = nodes.get(input.id); if (!node) throw Error('Unknown node'); if (node.type === 'building' && node.prediction) chooseTarget(node); inspect(node); return { id: node.id, type: node.type, predictionRevealed: predictionShown && node.id === target?.id }; } });
}

async function start() {
  const [response, mapResponse] = await Promise.all([fetch('data.json', { cache: 'no-store' }), fetch('basemap.json')]);
  if (!response.ok) throw Error('The local graph data could not be loaded.');
  if (!mapResponse.ok) throw Error('The local basemap positioning could not be loaded.');
  data = await response.json();
  basemap = await mapResponse.json();
  if (!data.nodes?.length || !data.edges) throw Error('The local graph dataset is incomplete.');
  setUpScene();
  $('data-notes').textContent = 'Links illustrate reconstructed graph relations and message passing. Building volumes use uniform schematic heights. The displayed plots include all their buildings and retain the original full-city predictions.';
  $('source-links').innerHTML = (data.meta.sources || []).filter(source => source.label !== 'Paper').map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.label)} ↗</a>`).join('');
  document.querySelectorAll('[data-stage]').forEach(button => button.onclick = () => setStage(+button.dataset.stage));
  document.querySelectorAll('button[data-graph-step]').forEach(button => button.onclick = () => stage === 3 ? setPropagateStep(+button.dataset.graphStep) : setGraphStep(+button.dataset.graphStep));
  $('next').onclick = () => nextStep();
  $('previous').onclick = () => stage === 3 && propagateStep > 0 ? setPropagateStep(propagateStep - 1) : stage === 2 && graphStep > 0 ? setGraphStep(graphStep - 1) : setStage(Math.max(0, stage - 1));
  $('play').onclick = () => {
    if (stage === 3 && loopPropagation) { flowPaused = !flowPaused; updatePlayButton(); return; }
    const play = !playbackRunning();
    if (play && stage === 3 && revealTime >= PREDICTION_FADE) setPropagateStep(0);
    setPlaying(play);
  };
  $('close-inspector').onclick = closeInspector;
  $('home-camera').onclick = () => { const targetPosition = viewGoal.clone(); camera.position.copy(targetPosition).add(new THREE.Vector3(560, 650, 850)); controls.target.copy(targetPosition); camera.lookAt(targetPosition); frameCamera(); };
  const about = open => { $('about-panel').hidden = !open; $('about-button').setAttribute('aria-expanded', String(open)); };
  $('about-button').onclick = () => about($('about-panel').hidden);
  $('close-about').onclick = () => about(false);
  addEventListener('keydown', event => { if (event.key === 'Escape') { closeInspector(); about(false); } });
  registerTools();
  $('loading').hidden = true;
}

start().catch(error => {
  $('loading').hidden = true; $('error').hidden = false;
  $('error').textContent = error.message;
  console.error(error);
});
