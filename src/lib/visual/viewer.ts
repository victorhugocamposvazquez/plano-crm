import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { loadVisualMaterials,plainMaterial as material,sceneColor as color,type VisualMaterials } from "./materials";
import type { SceneSelection,SpatialScene,VisualAsset } from "./schema";

export type SceneView="overview"|"inside"|"focus";
export type ViewerCommand="left"|"right"|"closer"|"farther";
function box(parent:THREE.Object3D,size:number[],position:number[],surface:THREE.Material,bevel=0) {
  const mesh=new THREE.Mesh(bevel?new RoundedBoxGeometry(...size as [number,number,number],2,bevel):new THREE.BoxGeometry(...size as [number,number,number]),surface);
  mesh.position.set(...position as [number,number,number]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function disposeTree(root:THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material]) materials.add(m);
    }
  });
  for(const m of materials) {for(const value of Object.values(m)) if(value instanceof THREE.Texture) textures.add(value);m.dispose();}
  for(const texture of textures) texture.dispose();for(const geometry of geometries) geometry.dispose();
}
function furnishing(parent:THREE.Group,asset:VisualAsset,resources:VisualMaterials) {
  const [w,h,d]=asset.dimensions_m!;
  if(asset.kind==="cabinet") {
    const body=resources.surface(asset,1,1,true),top=material([225,222,211],0.25),metal=material([48,48,43],0.3);metal.metalness=0.85;
    box(parent,[w,h-0.16,d-0.04],[0,h/2+0.04,-0.02],body,0.006);box(parent,[w,0.04,d],[0,h-0.02,0],top,0.008);
    for(const x of [-w/4,w/4]) {box(parent,[w/2-0.012,h-0.20,0.018],[x,h/2+0.02,d/2-0.031],body,0.004);box(parent,[0.09,0.014,0.022],[x,h*0.73,d/2-0.011],metal);}
    for(const x of [-w/2+0.07,w/2-0.07]) for(const z of [-d/2+0.06,d/2-0.06]) box(parent,[0.035,0.12,0.035],[x,0.06,z],metal);
  } else {
    const steel=material(asset.color,0.38),shelf=material([175,182,184],0.55),carton=material([171,148,110]);steel.metalness=0.75;shelf.metalness=0.6;
    for(const x of [-w/2+0.0325,w/2-0.0325]) for(const z of [-d/2+0.0325,d/2-0.0325]) box(parent,[0.065,h,0.065],[x,h/2,z],steel);
    for(let level=0;level<4;level++) {
      const y=0.15+level*(h-0.3)/3;box(parent,[w,0.05,d],[0,y,0],shelf);
      box(parent,[w,0.08,0.04],[0,y-0.04,d/2-0.02],steel);
      if(level<3) box(parent,[w*0.24,0.32,d*0.7],[-w*0.2,y+0.19,0],carton);
    }
  }
}

/** Escena sintética con materiales físicos. La geometría no determina precios ni cantidades. */
export async function createSpaceViewer(container:HTMLElement,spatial:SpatialScene,assets:VisualAsset[],selection:SceneSelection,onSelect:(slotId:string)=>void,onFailure:()=>void,signal?:AbortSignal) {
  const {width:w,depth:d,height:h}=spatial.dimensions_m;
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.95;
  const abort=()=>{renderer.dispose();renderer.forceContextLoss();};
  signal?.addEventListener("abort",abort,{once:true});
  let resources:VisualMaterials;
  try {resources=await loadVisualMaterials(Math.min(8,renderer.capabilities.getMaxAnisotropy()));}
  catch(error) {signal?.removeEventListener("abort",abort);abort();throw error;}
  signal?.removeEventListener("abort",abort);
  if(signal?.aborted) {resources.dispose();abort();throw new DOMException("Carga cancelada","AbortError");}
  const canvas=renderer.domElement;canvas.dataset.materialStatus=resources.complete?"ready":"degraded";canvas.setAttribute("aria-label","Espacio tridimensional. También puedes usar los botones de vista y la lista de artículos.");canvas.setAttribute("role","img");canvas.tabIndex=0;
  container.appendChild(canvas);
  const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,0.05,Math.max(w,d)*15);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=0.5;controls.maxDistance=Math.max(w,d)*4;
  controls.maxPolarAngle=Math.PI*0.495;controls.screenSpacePanning=false;
  world.environment=resources.environment;world.environmentIntensity=0.65;
  const ambient=new THREE.HemisphereLight(color([218,231,250]),color([156,142,121]),resources.environment?0.4:1.7);world.add(ambient);
  const light=new THREE.DirectionalLight(color([255,242,220]),3);light.position.set(-w*1.5,h*2,d*0.5);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);light.shadow.normalBias=0.015;light.shadow.camera.near=0.1;light.shadow.camera.far=Math.max(w,d,h)*8;light.shadow.camera.left=-w;light.shadow.camera.right=w;light.shadow.camera.top=d;light.shadow.camera.bottom=-d;light.shadow.bias=-0.0003;world.add(light);
  const enclosure=new THREE.Group();world.add(enclosure);
  const roots=new Map<string,THREE.Group>();let highlight:THREE.BoxHelper|null=null,selectedSlot=spatial.slots[0].id,currentSelection="",disposed=false;
  function render() {if(!disposed) {canvas.dataset.cameraDistance=String(controls.getDistance());renderer.render(world,camera);}}
  function theme() {world.background=new THREE.Color(getComputedStyle(container).getPropertyValue("--pl-document-bg").trim());if(highlight) highlight.material.color.set(getComputedStyle(container).getPropertyValue("--pl-blue").trim());render();}
  function update(next:SceneSelection,selected:string) {
    selectedSlot=selected;
    if(highlight) {world.remove(highlight);highlight.geometry.dispose();highlight.material.dispose();highlight=null;}
    const key=JSON.stringify(next);
    if(key!==currentSelection) {
      for(const root of roots.values()) {world.remove(root);disposeTree(root);}roots.clear();
      disposeTree(enclosure);enclosure.clear();
      for(const slot of spatial.slots) {
        const asset=assets.find(a=>a.id===next[slot.id])!;
        const root=new THREE.Group();root.userData.slotId=slot.id;roots.set(slot.id,root);world.add(root);
        if(slot.category==="floor") box(root,[w,0.08,d],[0,-0.04,0],resources.surface(asset,w,d));
        else if(slot.category==="wall") {
          const paint=resources.surface(asset,w,h),trim=material([221,217,208],0.5);
          box(root,[w+0.16,h,0.12],[0,h/2,-d/2-0.06],paint);
          if(spatial.space_kind!=="industrial" && d>1.5 && h>2.5) {
            // Hueco ficticio de 1,5 × 2 m: coincide con los 3 m² descontados en este ejemplo.
            const opening=1.5,bottom=0.5,top=2.5,side=(d-opening)/2;
            const sidePaint=resources.surface(asset,d,h);
            for(const z of [-1,1]) box(root,[0.12,h,side],[-w/2-0.06,h/2,z*(opening+side)/2],sidePaint);
            box(root,[0.12,bottom,opening],[-w/2-0.06,bottom/2,0],sidePaint);
            box(root,[0.12,h-top,opening],[-w/2-0.06,(h+top)/2,0],sidePaint);
            const frame=material([54,57,54],0.3);frame.metalness=0.6;
            for(const z of [-opening/2,0,opening/2]) box(root,[0.09,2.04,0.035],[-w/2+0.01,1.5,z],frame);
            for(const y of [bottom,top]) box(root,[0.09,0.035,opening],[-w/2+0.01,y,0],frame);
            box(root,[0.22,0.035,opening+0.1],[-w/2+0.04,bottom-0.02,0],trim,0.006);
          } else box(root,[0.12,h,d],[-w/2-0.06,h/2,0],resources.surface(asset,d,h));
          box(root,[w,0.10,0.035],[0,0.05,-d/2+0.02],trim);
          box(root,[0.035,0.10,d],[-w/2+0.02,0.05,0],trim);
          // Solo visibles desde dentro; contexto, sin medición o partida adicional.
          box(enclosure,[0.12,h,d],[w/2+0.06,h/2,0],resources.surface(asset,d,h));
          box(enclosure,[w,h,0.12],[0,h/2,d/2+0.06],paint);
          box(enclosure,[w,0.08,d],[0,h+0.04,0],material([236,232,221]));
        } else {
          for(const object of spatial.objects.filter(o=>o.slot_id===slot.id)) {const group=new THREE.Group();group.position.set(...object.position_m);root.add(group);furnishing(group,asset,resources);}
        }
      }
      currentSelection=key;
    }
    const root=roots.get(selectedSlot);
    if(root && spatial.slots.find(s=>s.id===selectedSlot)?.category==="furnishing") {highlight=new THREE.BoxHelper(root,new THREE.Color(getComputedStyle(container).getPropertyValue("--pl-blue").trim()));world.add(highlight);}
    render();
  }
  const existing=new THREE.Group();world.add(existing);
  for(const object of spatial.objects.filter(o=>o.kind==="existing_column")) box(existing,[0.3,h,0.3],[object.position_m[0],h/2,object.position_m[2]],material([195,196,191]));
  function view(mode:SceneView) {
    enclosure.visible=mode==="inside";
    if(mode==="inside") {camera.position.set(w*0.30,Math.min(1.55,h-0.25),d*0.40);controls.target.set(-w*0.05,Math.min(1.25,h/2),-d*0.35);}
    else if(mode==="focus" && roots.has(selectedSlot)) {
      const bounds=new THREE.Box3().setFromObject(roots.get(selectedSlot)!);const center=bounds.getCenter(new THREE.Vector3());
      const category=spatial.slots.find(s=>s.id===selectedSlot)?.category;
      if(category==="furnishing") {const size=bounds.getSize(new THREE.Vector3());const distance=Math.max(2.1,Math.max(size.x,size.y)*1.2);camera.position.set(center.x+distance*0.35,Math.max(1.35,center.y+distance*0.2),center.z+distance);controls.target.copy(center);}
      else {camera.position.set(w*0.65,h*1.2,d*0.9);controls.target.copy(center);}
    } else {camera.position.set(w*0.92,h*1.65,d*1.45);controls.target.set(0,h*0.32,0);}
    controls.update();render();
  }
  function command(action:ViewerCommand) {
    if(action==="left" || action==="right") controls.rotateLeft((action==="left"?1:-1)*Math.PI/12);
    else if(action==="closer") controls.dollyIn(1/1.18); else controls.dollyOut(1/1.18);
    controls.update();render();
  }
  const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(width<1 || height<1) return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();});observer.observe(container);
  const themeObserver=new MutationObserver(theme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let downX=0,downY=0;
  const down=(event:PointerEvent)=>{downX=event.clientX;downY=event.clientY;};
  const up=(event:PointerEvent)=>{
    if(Math.hypot(event.clientX-downX,event.clientY-downY)>6) return;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...roots.values()],true)[0];let object:THREE.Object3D|null=hit?.object ?? null;
    while(object && !object.userData.slotId) object=object.parent;
    if(object?.userData.slotId) onSelect(object.userData.slotId);
  };
  const lost=(event:Event)=>{event.preventDefault();onFailure();};
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointerup",up);canvas.addEventListener("webglcontextlost",lost);
  controls.addEventListener("change",render);update(selection,selectedSlot);theme();view("overview");
  return {update,view,command,dispose(){
    disposed=true;observer.disconnect();themeObserver.disconnect();controls.removeEventListener("change",render);controls.dispose();
    canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("webglcontextlost",lost);
    disposeTree(world);resources.dispose();light.shadow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }};
}
