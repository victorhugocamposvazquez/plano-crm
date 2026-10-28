import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import type { VisualAsset } from "./schema";

const base="/visual/materiales/";
const names=["laminate_floor_02_diff_1k.jpg","laminate_floor_02_nor_gl_1k.jpg","laminate_floor_02_rough_1k.jpg",
  "marble_tiles_diff_1k.jpg","marble_tiles_nor_gl_1k.jpg","marble_tiles_rough_1k.jpg","plastered_wall_02_nor_gl_1k.jpg"] as const;
export const sceneColor=(rgb:readonly number[])=>new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255,THREE.SRGBColorSpace);
export const plainMaterial=(rgb:readonly number[],roughness=0.75)=>new THREE.MeshStandardMaterial({color:sceneColor(rgb),roughness});

/** Recursos locales CC0, compartidos solo durante la vida de este visor. */
export async function loadVisualMaterials(anisotropy:number) {
  const loader=new THREE.TextureLoader();
  const results=await Promise.allSettled([...names.map(name=>loader.loadAsync(base+name)),new HDRLoader().loadAsync(base+"studio_small_09_1k.hdr")]);
  const source=new Map<string,THREE.Texture>();
  names.forEach((name,i)=>{const result=results[i];if(result.status==="fulfilled") source.set(name,result.value);});
  const environmentResult=results[names.length];
  const environment=environmentResult.status==="fulfilled"?environmentResult.value:null;
  if(environment) environment.mapping=THREE.EquirectangularReflectionMapping;
  function map(name:string,x:number,y:number,srgb=false) {
    const original=source.get(name);if(!original) return null;
    const texture=original.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(x,y);
    texture.anisotropy=anisotropy;texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.needsUpdate=true;return texture;
  }
  function surface(asset:VisualAsset,width:number,height:number,furniture=false) {
    const mat=plainMaterial(asset.color,asset.kind==="resin"?0.32:0.75);
    const wood=asset.kind==="wood" || furniture;
    if(wood || asset.kind==="stone") {
      const slug=wood?"laminate_floor_02":"marble_tiles",tile=wood?1.7:2;
      mat.map=map(slug+"_diff_1k.jpg",width/tile,height/tile,true);
      mat.normalMap=map(slug+"_nor_gl_1k.jpg",width/tile,height/tile);
      mat.roughnessMap=map(slug+"_rough_1k.jpg",width/tile,height/tile);
      if(mat.map) mat.color.copy(furniture?sceneColor(asset.color).lerp(new THREE.Color(1,1,1),0.5):new THREE.Color(1,1,1));
      mat.roughness=wood?0.7:0.65;mat.normalScale.setScalar(wood?0.3:0.45);
    } else {
      mat.normalMap=map("plastered_wall_02_nor_gl_1k.jpg",width/2,height/2);
      mat.normalScale.setScalar(asset.kind==="mineral"?0.35:asset.kind==="resin"?0.025:0.08);
    }
    return mat;
  }
  return {environment,surface,complete:results.every(result=>result.status==="fulfilled"),dispose(){
    for(const texture of source.values()) texture.dispose();environment?.dispose();
  }};
}
export type VisualMaterials=Awaited<ReturnType<typeof loadVisualMaterials>>;
