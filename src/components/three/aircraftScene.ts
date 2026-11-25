import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Aeronave comercial genérica modelada proceduralmente no próprio código
// (sem arquivo de terceiros, sem pintura de companhia real). Substituível por
// um GLB licenciado com compressão Draco/Meshopt quando houver; ver
// docs/licencas-imagens.md.
//
// Eixos: nariz em +X, envergadura em Z, Y para cima. Unidades arbitrárias
// (fuselagem com 10 de comprimento e raio 0,5).

const L = 10;
const R = 0.5;
const NOSE = 1.7;
const TAIL_START = 6.6;

/** Raio e altura do eixo da fuselagem em função da distância s a partir do nariz. */
function fuselageSection(s: number): { r: number; yc: number } {
  if (s <= NOSE) {
    const u = 1 - s / NOSE;
    return { r: R * Math.sqrt(Math.max(0, 1 - u * u)) ** 1.15, yc: -0.16 * R * u * u };
  }
  if (s <= TAIL_START) return { r: R, yc: 0 };
  const t = Math.min(1, (s - TAIL_START) / (L - TAIL_START));
  // cone de cauda subindo: a parte de baixo sobe, a de cima quase reta
  return { r: R * Math.max(0, 1 - t ** 1.5) ** 0.75, yc: 0.62 * R * t ** 1.4 };
}

/** Ponto na superfície: θ = 0 no topo, positivo em direção a +Z. */
function fuselagePoint(s: number, theta: number, offset = 0): THREE.Vector3 {
  const { r, yc } = fuselageSection(s);
  const rr = r + offset;
  return new THREE.Vector3(L / 2 - s, yc + rr * Math.cos(theta), rr * Math.sin(theta) * 0.97);
}

function surfacePatch(s0: number, s1: number, t0: number, t1: number, offset: number, ns: number, nt: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= ns; i++) {
    const s = s0 + ((s1 - s0) * i) / ns;
    for (let j = 0; j <= nt; j++) {
      const p = fuselagePoint(s, t0 + ((t1 - t0) * j) / nt, offset);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j;
      const b = a + nt + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fuselageGeometry(): THREE.BufferGeometry {
  // anel fechado sem vértice duplicado na costura, para normais suaves
  const rings = 160;
  const seg = 64;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const s = L * (1 - Math.cos((Math.PI * i) / rings)) / 2; // mais anéis nas pontas
    for (let j = 0; j < seg; j++) {
      const p = fuselagePoint(s, (2 * Math.PI * j) / seg);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const a2 = i * seg + ((j + 1) % seg);
      const b = a + seg;
      const b2 = a2 + seg;
      idx.push(a, b, a2, a2, b, b2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Perfil NACA simétrico de 4 dígitos: laço fechado (x da corda 0..1, y espessura). */
function airfoil(thickness: number, n = 28): [number, number][] {
  const pts: [number, number][] = [];
  const yt = (x: number) =>
    5 * thickness * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  for (let i = n; i >= 0; i--) {
    const x = (1 - Math.cos((Math.PI * i) / n)) / 2;
    pts.push([x, yt(x)]);
  }
  for (let i = 1; i < n; i++) {
    const x = (1 - Math.cos((Math.PI * i) / n)) / 2;
    pts.push([x, -yt(x)]);
  }
  return pts;
}

interface Section {
  le: THREE.Vector3; // bordo de ataque
  chord: number;
  thickness: number; // razão espessura/corda
}

/** Superfície sustentadora por interpolação entre seções de perfil. */
function loft(sections: Section[], chordDir: THREE.Vector3, thickDir: THREE.Vector3): THREE.BufferGeometry {
  const profile = airfoil(1); // escalado por seção
  const m = profile.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const point = (sec: Section, [x, y]: [number, number]) =>
    sec.le
      .clone()
      .addScaledVector(chordDir, x * sec.chord)
      .addScaledVector(thickDir, y * sec.thickness * sec.chord);

  sections.forEach((sec) => profile.forEach((p) => {
    const v = point(sec, p);
    pos.push(v.x, v.y, v.z);
  }));
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * m + j;
      const a2 = i * m + ((j + 1) % m);
      idx.push(a, a + m, a2, a2, a + m, a2 + m);
    }
  }
  // tampas planas nas pontas
  for (const end of [0, sections.length - 1]) {
    const base = pos.length / 3;
    const c = point(sections[end], [0.4, 0]);
    pos.push(c.x, c.y, c.z);
    profile.forEach((p) => {
      const v = point(sections[end], p);
      pos.push(v.x, v.y, v.z);
    });
    for (let j = 0; j < m; j++) {
      const a = base + 1 + j;
      const b = base + 1 + ((j + 1) % m);
      if (end === 0) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const AFT = new THREE.Vector3(-1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(0, 0, 1);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function mirrorZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.clone();
  m.scale(1, 1, -1);
  // espelhar inverte a orientação dos triângulos
  const index = m.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  m.computeVertexNormals();
  return m;
}

function wingGeometry(): THREE.BufferGeometry {
  return loft(
    [
      { le: v(1.05, -0.3, 0.2), chord: 2.5, thickness: 0.14 },
      { le: v(0.12, -0.17, 1.85), chord: 1.42, thickness: 0.12 },
      { le: v(-1.9, 0.1, 5.3), chord: 0.52, thickness: 0.1 },
    ],
    AFT,
    UP,
  );
}

function wingletGeometry(): THREE.BufferGeometry {
  return loft(
    [
      { le: v(-1.88, 0.06, 5.28), chord: 0.54, thickness: 0.1 },
      { le: v(-2.05, 0.3, 5.36), chord: 0.42, thickness: 0.1 },
      { le: v(-2.32, 0.78, 5.42), chord: 0.24, thickness: 0.1 },
    ],
    AFT,
    SIDE,
  );
}

function stabilizerGeometry(): THREE.BufferGeometry {
  return loft(
    [
      { le: v(-3.25, 0.12, 0.1), chord: 1.25, thickness: 0.1 },
      { le: v(-4.55, 0.26, 1.95), chord: 0.46, thickness: 0.09 },
    ],
    AFT,
    UP,
  );
}

function finGeometry(): THREE.BufferGeometry {
  return loft(
    [
      { le: v(-2.75, 0.3, 0), chord: 2.05, thickness: 0.1 },
      { le: v(-3.3, 0.75, 0), chord: 1.6, thickness: 0.1 },
      { le: v(-4.45, 2.15, 0), chord: 0.72, thickness: 0.09 },
    ],
    AFT,
    SIDE,
  );
}

function engine(skin: THREE.Material, lip: THREE.Material, dark: THREE.Material, wing: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // perfil da nacele: da borda interna da entrada de ar até o bocal de exaustão
  const profile: [number, number][] = [
    [0.24, 0.22],
    [0.255, 0.06],
    [0.285, 0.0],
    [0.315, 0.04],
    [0.335, 0.25],
    [0.335, 0.6],
    [0.31, 1.05],
    [0.26, 1.38],
    [0.22, 1.5],
  ];
  const nacelleGeo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const nacelle = new THREE.Mesh(nacelleGeo, skin);

  const lipGeo = new THREE.LatheGeometry(
    ([[0.24, 0.22], [0.255, 0.06], [0.285, 0.0], [0.315, 0.04]] as [number, number][]).map(([r, y]) => new THREE.Vector2(r + 0.002, y)),
    48,
  );
  const lipMesh = new THREE.Mesh(lipGeo, lip);

  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.245, 48), dark);
  fan.rotation.x = Math.PI / 2;
  fan.position.y = 0.2;
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 32), lip);
  spinner.rotation.x = Math.PI;
  spinner.position.y = 0.13;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.3, 32), wing);
  core.position.y = 1.62;
  const plug = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 32), dark);
  plug.position.y = 1.9;

  const lathe = new THREE.Group();
  lathe.add(nacelle, lipMesh, fan, spinner, core, plug);
  lathe.rotation.z = Math.PI / 2; // eixo do torno (+Y) passa a apontar para trás (-X)
  g.add(lathe);

  const pylon = new THREE.Mesh(
    loft(
      [
        { le: v(-0.35, 0.22, 0), chord: 1.5, thickness: 0.09 },
        { le: v(-0.75, 0.46, 0), chord: 1.3, thickness: 0.09 },
      ],
      AFT,
      SIDE,
    ),
    wing,
  );
  g.add(pylon);
  return g;
}

function cabinWindows(material: THREE.Material): THREE.InstancedMesh {
  const shape = new THREE.Shape();
  const w = 0.055;
  const h = 0.085;
  const r = 0.025;
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  const positions: number[] = [];
  for (let s = 2.0; s <= 6.7; s += 0.2) {
    if (Math.abs(s - 3.9) < 0.18) continue; // espaço da porta sobre a asa
    positions.push(s);
  }
  const mesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(shape, 4), material, positions.length * 2);
  const dummy = new THREE.Object3D();
  let k = 0;
  const theta = 1.2; // pouco acima da linha média
  for (const s of positions) {
    for (const side of [1, -1]) {
      const p = fuselagePoint(s, side * theta, 0.004);
      const center = fuselagePoint(s, side * theta, -1);
      dummy.position.copy(p);
      dummy.up.set(0, 1, 0);
      dummy.lookAt(p.clone().add(p.clone().sub(center)));
      dummy.updateMatrix();
      mesh.setMatrixAt(k++, dummy.matrix);
    }
  }
  return mesh;
}

export function mountAircraft(canvas: HTMLCanvasElement, opts: { animate: boolean }): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.set(11, 3.6, 8.2);
  camera.lookAt(-0.2, 0.1, 0.3);

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf3f6f9, metalness: 0.05, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const nacellePaint = paint.clone();
  nacellePaint.side = THREE.DoubleSide;
  // DoubleSide nas superfícies geradas: o shader corrige a normal das faces de trás
  const alloy = new THREE.MeshStandardMaterial({ color: 0xc3ced9, metalness: 0.45, roughness: 0.35, side: THREE.DoubleSide });
  const polished = new THREE.MeshStandardMaterial({ color: 0xd9e2ea, metalness: 0.95, roughness: 0.18, side: THREE.DoubleSide });
  const brand = new THREE.MeshPhysicalMaterial({ color: 0x102d4c, metalness: 0.2, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide });
  const accent = new THREE.MeshStandardMaterial({ color: 0x48a5e8, metalness: 0.2, roughness: 0.35, emissive: 0x1769aa, emissiveIntensity: 0.25, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1626, metalness: 0.7, roughness: 0.12, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18212c, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });

  const plane = new THREE.Group();
  plane.add(new THREE.Mesh(fuselageGeometry(), paint));

  // faixa azul ao longo da fuselagem e para-brisa
  plane.add(new THREE.Mesh(surfacePatch(1.2, 7.8, 1.5, 1.66, 0.003, 60, 3), accent));
  plane.add(new THREE.Mesh(surfacePatch(1.2, 7.8, -1.66, -1.5, 0.003, 60, 3), accent));
  plane.add(new THREE.Mesh(surfacePatch(0.62, 0.92, -0.95, 0.95, 0.004, 8, 24), glass));
  plane.add(cabinWindows(glass));

  const wing = wingGeometry();
  const winglet = wingletGeometry();
  const stab = stabilizerGeometry();
  plane.add(new THREE.Mesh(wing, alloy), new THREE.Mesh(mirrorZ(wing), alloy));
  plane.add(new THREE.Mesh(winglet, brand), new THREE.Mesh(mirrorZ(winglet), brand));
  plane.add(new THREE.Mesh(stab, alloy), new THREE.Mesh(mirrorZ(stab), alloy));
  plane.add(new THREE.Mesh(finGeometry(), brand));

  for (const side of [1, -1]) {
    const e = engine(nacellePaint, polished, dark, alloy);
    e.position.set(1.3, -0.62, side * 1.8);
    plane.add(e);
  }

  plane.rotation.set(0, 0.12, 0.04);
  scene.add(plane);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 9, 7);
  const rim = new THREE.DirectionalLight(0x48a5e8, 2.6);
  rim.position.set(-8, 2, -6);
  const under = new THREE.PointLight(0x1769aa, 14, 18);
  under.position.set(0, -4, 3);
  scene.add(key, rim, under);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  let frame = 0;
  const clock = new THREE.Clock();
  function tick() {
    frame = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    plane.rotation.y = 0.12 + Math.sin(t * 0.16) * 0.22;
    plane.rotation.z = 0.04 + Math.sin(t * 0.45) * 0.035;
    plane.position.y = Math.sin(t * 0.6) * 0.1;
    renderer.render(scene, camera);
  }
  if (opts.animate) tick();
  else renderer.render(scene, camera);

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    io.disconnect();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    [paint, nacellePaint, alloy, polished, brand, accent, glass, dark].forEach((m) => m.dispose());
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
