import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Layout } from "../../../../../shared/community";
const colors: Record<string, number> = {
  outline: 0xe0e8e3,
  flat: 0xc6ef75,
  shop: 0xf3dab1,
  common: 0xdbe7ea,
  stairs: 0xd7d3f0,
  lift: 0xc3dfd5,
};
export default function Building3D({
  layouts,
  onSelect,
}: {
  layouts: Layout[];
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [error, setError] = useState("");
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError("3D is unavailable on this device. Use the 2D floor plan.");
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F2F6F3");
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 20000);
    camera.position.set(1200, 1000, 1200);
    const controls = new OrbitControls(camera, renderer.domElement);
    const minFloor = Math.min(0, ...layouts.map((l) => l.floor));
    controls.enableDamping = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D apartment building. Drag to rotate, scroll to zoom.",
    );
    scene.add(new THREE.HemisphereLight(0xffffff, 0x668877, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(700, 1000, 500);
    scene.add(light);
    const meshes: THREE.Mesh[] = [];
    for (const floor of layouts)
      for (const item of floor.shapes) {
        if (item.points.length < 3) continue;
        const shape = new THREE.Shape();
        item.points.forEach((p, i) =>
          i === 0
            ? shape.moveTo(p.x - 500, 300 - p.y)
            : shape.lineTo(p.x - 500, 300 - p.y),
        );
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: item.kind === "outline" ? 5 : 42,
          bevelEnabled: false,
        });
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({
          color: colors[item.kind] ?? 0xdbe7ea,
          transparent: item.kind === "outline",
          opacity: item.kind === "outline" ? 0.3 : 0.85,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = (floor.floor - minFloor) * 70;
        mesh.userData.shapeId = item.id;
        scene.add(mesh);
        meshes.push(mesh);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0x739a82 }),
        );
        edges.position.copy(mesh.position);
        scene.add(edges);
      }
    const bounds = new THREE.Box3();
    meshes.forEach((mesh) => bounds.expandByObject(mesh));
    const center = bounds.isEmpty()
      ? new THREE.Vector3()
      : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty()
      ? new THREE.Vector3(1000, 70, 600)
      : bounds.getSize(new THREE.Vector3());
    controls.target.copy(center);
    const resize = () => {
      const width = element.clientWidth;
      renderer.setSize(width, 450);
      camera.aspect = width / 450;
      const distance =
        (Math.max(size.y, size.x / camera.aspect, size.z / camera.aspect) /
          (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
        1.6;
      camera.position
        .copy(center)
        .add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance));
      camera.far = Math.max(20000, distance * 5);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
    let pressed = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      pressed = { x: e.clientX, y: e.clientY };
    };
    const pick = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(meshes)
        .find((h) => h.object instanceof THREE.Mesh);
      if (hit) select.current(String(hit.object.userData.shapeId));
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", pick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", pick);
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        ) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [layouts]);
  return (
    <div>
      <p className="community-muted">
        Drag to rotate · Scroll to zoom · Select a space to return to its floor.
        Heights are illustrative.
      </p>
      {error && <p role="status">{error}</p>}
      <div ref={host} className="community-3d" />
    </div>
  );
}
