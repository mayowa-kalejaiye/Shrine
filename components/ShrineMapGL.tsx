"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Location01Icon } from "hugeicons-react";
import { Shrine, CITIES } from "@/lib/shrine-data";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function ShrineMapGL({ shrines, onPick, onHover, onSelect, selectedId, traceHandle }: { shrines: Shrine[], onPick?: (lat:number,lng:number)=>void, onHover?: (id:string|null)=>void, onSelect?: (s:Shrine)=>void, selectedId?: string|null, traceHandle?: string|null }){
  const traceRef = useRef(traceHandle); useEffect(()=>{ traceRef.current = traceHandle; },[traceHandle]);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map|null>(null);
  const onPickRef = useRef(onPick); const onSelectRef = useRef(onSelect); const onHoverRef = useRef(onHover);
  useEffect(()=>{ onPickRef.current=onPick; },[onPick]);
  useEffect(()=>{ onSelectRef.current=onSelect; },[onSelect]);
  useEffect(()=>{ onHoverRef.current=onHover; },[onHover]);

  useEffect(()=>{
    if(!ref.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/standard-satellite",
      center: [18, 14],
      zoom: 1.6,
      pitch: 0,
      bearing: -8,
      antialias: true,
      projection: { name: "globe" } as any,
      attributionControl: false as any,
      maxZoom: 22,
      fadeDuration: 0 as any,
      crossSourceCollisions: false as any,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch:true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    // suppress noisy zoom-level warnings (still zooms, just no tile)
    map.on("error", (e:any)=>{ const m = String(e?.error?.message || e?.message || ""); if(/zoom|not supported|terrain|dem/i.test(m)) (e as any).preventDefault?.(); });
    
    map.on("click", (e:any)=>{
      const target = (e.originalEvent?.target as HTMLElement)?.closest?.(".shrine-marker, .mapboxgl-marker");
      if(target) return;
      onPickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });
    // idle twirl — after 7s true idleness, world view only, never while reading
    let userInteracting = false;
    let spinPaused = true;
    let resumeTimer: any = null;
    const pauseSpin = ()=> { userInteracting = true; spinPaused = true; if(resumeTimer) clearTimeout(resumeTimer); };
    const resumeSpin = ()=> {
      userInteracting = false;
      if(resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(()=> { spinPaused = false; }, 7000);
    };
    map.on("mousedown", pauseSpin);
    map.on("dragstart", pauseSpin);
    map.on("touchstart", pauseSpin);
    map.on("wheel", pauseSpin);
    map.on("movestart", ()=> { if(userInteracting) spinPaused = true; });
    map.on("moveend", resumeSpin);
    map.on("mouseup", resumeSpin);
    map.on("touchend", resumeSpin);
    resumeTimer = setTimeout(()=> { spinPaused = false; }, 7000);
    const spin = setInterval(()=>{
      const sel = (map as any)._selectedId;
      if(spinPaused || userInteracting || sel) return;
      if(document.hidden) return;
      if(map.isMoving() || map.isZooming() || map.isRotating()) return;
      if(map.getZoom() > 4) return; // world globe only — never while exploring streets
      map.setBearing(map.getBearing() + 0.09);
    }, 40);
    (map as any)._spinInt = spin;

    map.on("style.load", ()=>{
      // standard-satellite already has embedded country/street/place labels + building footprints — keep them
      try{
        map.setFog({ color: "rgb(4, 6, 12)", "high-color": "rgb(44, 57, 83)", "horizon-blend": 0.08, "space-color": "rgb(0, 0, 0)", "star-intensity": 0.22, range: [0.5, 10] } as any);
      }catch{}
      // REAL DAY/NIGHT — map stays light satellite (as you put), but night side gets subtle shade + city lights where it's dark
      const updateLights = ()=>{
        try{ (map as any).setConfigProperty("basemap", "lightPreset", "day"); }catch{}
        try{ (map as any).setConfigProperty("basemap", "showPlaceLabels", true); }catch{}
        try{ (map as any).setConfigProperty("basemap", "showRoadLabels", true); }catch{}
        try{ (map as any).setConfigProperty("basemap", "showPointOfInterestLabels", true); }catch{}
        // keep map light and crisp, but add terminator shade where it's night
        try{
          const now = new Date();
          const utcH = now.getUTCHours() + now.getUTCMinutes()/60;
          const sunLng = 180 - utcH*15;
          // night polygon: where local solar time is night
          const nightCoords: [number,number][] = [];
          for(let lng=-180; lng<=180; lng+=4){
            const localH = (utcH + lng/15 + 24)%24;
            const isNightLng = localH<6 || localH>18;
            // if night at this lng, cover whole lat band dark, else light
            // we add a fill for night side as vertical strips
            if(isNightLng){
              nightCoords.push([lng, -60], [lng, 80]);
            }
          }
          // update night shade source if exists
          const nightSrc = map.getSource("night-shade") as any;
          if(nightSrc){
            // rebuild as multi-polygon strips for night longitudes
            const feats:any[] = [];
            for(let lng=-180; lng<180; lng+=8){
              const localH = (utcH + lng/15 + 24)%24;
              if(localH<6 || localH>18){
                feats.push({ type:"Feature", geometry:{ type:"Polygon", coordinates:[[[lng,-60],[lng+8,-60],[lng+8,80],[lng,80],[lng,-60]]] }, properties:{} });
              }
            }
            nightSrc.setData({ type:"FeatureCollection", features: feats } as any);
          }
        }catch{}
        try{ map.setFog({ color: "rgb(220, 230, 245)", "high-color": "rgb(200, 215, 240)", "horizon-blend": 0.02, "space-color": "rgb(0, 0, 0)", "star-intensity": 0.04, range: [0.5, 10] } as any); }catch{}
        try{
          if(map.getLayer("3d-buildings")){
            map.setPaintProperty("3d-buildings", "fill-extrusion-opacity", 0.42);
            map.setPaintProperty("3d-buildings", "fill-extrusion-color", "#2a2a2e");
          }
          const layer = map.getLayer("shrine-pillars") as any;
          if(layer?.group){
            layer.group.children.forEach((m:any, i:number)=>{
              if(m.material){
                m.material.emissiveIntensity = i%2===0?0.48:0.92;
                m.material.opacity = 0.96;
              }
            });
          }
        }catch{}
      };
      updateLights();
      const lightInt = setInterval(updateLights, 60000);
      (map as any)._lightInt = lightInt;
      // night shade — where it's night (behind buildings, above satellite) — must be before 3d-buildings so buildings stay lit
      const layers = map.getStyle().layers;
      const labelLayer = layers.find(l=> l.type==="symbol" && (l.layout as any)?.["text-field"])?.id;
      if(!map.getSource("night-shade")){
        map.addSource("night-shade", { type:"geojson", data:{ type:"FeatureCollection", features:[] } } as any);
        map.addLayer({ id:"night-shade", type:"fill", source:"night-shade", paint:{ "fill-color":"#0a0a1a", "fill-opacity": 0.22 } } as any, labelLayer);
      }
      // 3D buildings — Mapbox fill-extrusion
      if(!map.getLayer("3d-buildings")){
        map.addLayer({
          id:"3d-buildings",
          source:"composite",
          "source-layer":"building",
          filter:["==", "extrude", "true"],
          type:"fill-extrusion",
          minzoom:14,
          paint:{
            "fill-extrusion-color":"#1a1a1f",
            "fill-extrusion-height":["get","height"],
            "fill-extrusion-base":["get","min_height"],
            "fill-extrusion-opacity":0.55,
          }
        } as any, labelLayer);
      }
      if(!map.getSource("night-shade")){
        map.addSource("night-shade", { type:"geojson", data:{ type:"FeatureCollection", features:[] } } as any);
        map.addLayer({ id:"night-shade", type:"fill", source:"night-shade", paint:{ "fill-color":"#0a0a1a", "fill-opacity": 0.22 } } as any, labelLayer);
      }
      // REAL CLOUDS — deferred until idle so tiles + markers paint first
      const loadRain = () => fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then(r=> r.json())
        .then((data:any)=>{
          const frames = data?.radar?.past?.slice(-8) || [];
          if(!frames.length) return;
          frames.forEach((f:any, i:number)=>{
            const id = `clouds-${i}`;
            if(map.getSource(id)) return;
            map.addSource(id, {
              type:"raster",
              tiles:[`https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/1_1.png`],
              tileSize:256, minzoom:0, maxzoom:14
            } as any);
            map.addLayer({
              id, type:"raster", source: id,
              layout:{ visibility: i===frames.length-1 ? "visible" : "none" },
              paint:{ "raster-opacity": 0.42, "raster-opacity-transition":{duration:200}, "raster-hue-rotate": 12 }
            } as any);
          });
          let cur = frames.length-1;
          const anim = setInterval(()=>{
            const prev = `clouds-${cur}`;
            cur = (cur+1) % frames.length;
            const next = `clouds-${cur}`;
            if(map.getLayer(prev)) map.setLayoutProperty(prev, "visibility", "none");
            if(map.getLayer(next)) map.setLayoutProperty(next, "visibility", "visible");
          }, 850);
          (map as any)._cloudAnim = anim;
        }).catch(()=>{});
      if("requestIdleCallback" in window) (window as any).requestIdleCallback(loadRain, { timeout: 4000 });
      else setTimeout(loadRain, 2500);
      // super clear street — balanced exposure, never blown white, never dark
      map.on("zoom", ()=>{
        const z = map.getZoom();
        try{
          if(z>14){
            map.setFog({ range: [-1, 1.1], color: "#101318", "high-color": "#1a2030", "horizon-blend": 0.01, "space-color": "#000000", "star-intensity": 0 } as any);
            if(map.getLayer("night-shade")) map.setPaintProperty("night-shade", "fill-opacity", 0);
            try{ map.setLight({ anchor:"viewport", color:"#fff5e8", intensity: 0.68, position:[1.15, 120, 55] } as any); }catch{}
            const canvas = map.getCanvas();
            canvas.style.filter = "saturate(1.22) contrast(1.16) brightness(0.96)";
            try{ (map as any).setConfigProperty("basemap", "showRoadLabels", true); }catch{}
          } else {
            map.setFog({ range: [-1, 2], color: "#0a0a0b", "high-color": "#1a1a2e", "horizon-blend": 0.12, "space-color": "#000000", "star-intensity": 0.18 } as any);
            if(map.getLayer("night-shade")) map.setPaintProperty("night-shade", "fill-opacity", 0.22);
            try{ map.setLight({ anchor:"viewport", color:"#ffffff", intensity: 0.85, position:[1.15, 120, 45] } as any); }catch{}
            const canvas = map.getCanvas();
            canvas.style.filter = "";
          }
        }catch{}
      });
      // terrain removed — mapbox-dem maxes at z14 and throws "zoom not supported" at street 19.5
      try{ map.setTerrain(null as any); }catch{}

      // CONNECTIONS — traced person > selected person > yours, so it never clashes
      const drawConnections = ()=>{
        let focusHandle: string|null = traceRef.current || null;
        if(!focusHandle){
          try{
            const sel = (map as any)._selectedId as string|null;
            if(sel){ const f = shrines.find(x=> x.id===sel); if(f) focusHandle = f.handle; }
          }catch{}
        }
        let myHandle = "you";
        try{ myHandle = localStorage.getItem("shrine_handle") || "you"; }catch{}
        const allowed = new Set<string>();
        if(focusHandle) allowed.add(focusHandle);
        allowed.add(myHandle); allowed.add("you");
        const byHandle: Record<string, typeof shrines> = {};
        shrines.forEach(s=> { if(!allowed.has(s.handle)) return; (byHandle[s.handle] ||= []).push(s); });
        const feats:any[] = [];
        Object.values(byHandle).forEach(list=>{
          if(list.length<2) return;
          const sorted=[...list].sort((a,b)=> a.createdAt-b.createdAt);
          for(let i=0;i<sorted.length-1;i++){
            feats.push({ type:"Feature", geometry:{ type:"LineString", coordinates:[[sorted[i].lng, sorted[i].lat],[sorted[i+1].lng, sorted[i+1].lat]] }, properties:{ handle: sorted[i].handle, you: true } });
          }
        });
        const src = map.getSource("connections") as any;
        if(src) src.setData({ type:"FeatureCollection", features: feats } as any);
        else{
          map.addSource("connections", { type:"geojson", data:{ type:"FeatureCollection", features: feats } } as any);
          map.addLayer({ id:"connections-you", type:"line", source:"connections", paint:{ "line-color":"#ff3b30", "line-width":1.6, "line-dasharray":[2,2], "line-opacity":0.75 } } as any);
        }
      };
      drawConnections();
      (map as any)._drawConnections = drawConnections;
      // animate dash — moving dots
      let dashPhase = 0;
      const dashAnim = setInterval(()=>{
        dashPhase = (dashPhase+1)%4;
        try{
          if(map.getLayer("connections-you")) map.setPaintProperty("connections-you", "line-dasharray", dashPhase%2===0 ? [2,2] : [0.4,2,1.6,2]);
          if(map.getLayer("connections-other")) map.setPaintProperty("connections-other", "line-dasharray", dashPhase%2===0 ? [1.5,2.5] : [0.5,2.5,1,2.5]);
        }catch{}
      }, 180);
      (map as any)._dashAnim = dashAnim;

      // Three.js pillars — prefetched while map boots, applied the instant style loads
      import(/* webpackPrefetch: true */ "three").then(THREE => {
      const customLayer = {
        id: "shrine-pillars",
        type: "custom" as const,
        renderingMode: "3d" as const,
        onAdd(map:any, gl:any){
          this.scene = new THREE.Scene();
          this.camera = new THREE.Camera();
          this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias:true, alpha:true });
          this.renderer.autoClear = false;
          // lights
          const dir = new THREE.DirectionalLight(0xffffff, 0.9);
          dir.position.set(0, -70, 100).normalize();
          this.scene.add(dir);
          this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
          // pillars group
          this.group = new THREE.Group();
          this.scene.add(this.group);
          this.pillars = new Map();
        },
        render(gl:any, matrix:number[]){
          const m = new THREE.Matrix4().fromArray(matrix);
          (this.camera as any).projectionMatrix = m;
          this.renderer.resetState();
          this.renderer.render(this.scene as any, this.camera as any);
          (map as any).triggerRepaint();
        }
      } as any;

      if(!map.getLayer("shrine-pillars")){
        map.addLayer(customLayer);
      }

      // helper to sync pillars
      const syncPillars = ()=>{
        const layer = map.getLayer("shrine-pillars") as any;
        if(!layer?.group) return;
        // clear
        while(layer.group.children.length) layer.group.remove(layer.group.children[0]);
        // limit pillars to 80 for perf (30 per city would be 500+ meshes heavy)
        shrines.slice(0,80).forEach(s=>{
          const h = 80 + (s.id.charCodeAt(2)%5)*24;
          const geo = new THREE.BoxGeometry(28, 28, h);
          const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff3b30, emissiveIntensity: 0.35, transparent:true, opacity:0.95 });
          const mesh = new THREE.Mesh(geo, mat);
          const merc = (mapboxgl as any).MercatorCoordinate.fromLngLat([s.lng, s.lat], 0);
          mesh.position.set(merc.x, merc.y, h/2 / 100000);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(30,30,6), new THREE.MeshStandardMaterial({color:0xff3b30, emissive:0xff3b30, emissiveIntensity:1}));
          cap.position.set(merc.x, merc.y, (h+3)/100000);
          layer.group.add(mesh);
          layer.group.add(cap);
        });
      };
      // initial + on shrines change
      setTimeout(syncPillars, 500);
      (map as any)._syncPillars = syncPillars;
      }).catch(()=>{});
    });

    return ()=> { const a=(map as any)._cloudAnim; if(a) clearInterval(a); const b=(map as any)._lightInt; if(b) clearInterval(b); const d=(map as any)._dashAnim; if(d) clearInterval(d); map.remove(); mapRef.current=null; };
  },[]);

  // trace mode — fit everywhere one handle has been
  useEffect(()=>{
    const map = mapRef.current;
    if(!map || !traceHandle) return;
    const pins = shrines.filter(s=> s.handle===traceHandle);
    if(!pins.length) return;
    (map as any)._drawConnections?.();
    try{
      const b = new (mapboxgl as any).LngLatBounds();
      pins.forEach(p=> b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: { top: 90, bottom: 200, left: 60, right: 60 }, maxZoom: 11, duration: 2000 });
    }catch{}
  },[traceHandle, shrines]);

  // fly to selected from feed drawer, zoom out when closed + track for spin pause + halo
  const prevSelectedRef = useRef<string|null>(null);
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    (map as any)._selectedId = selectedId;
    (map as any)._drawConnections?.();
    const halo = map.getSource("selected-halo") as any;
    if(selectedId){
      const s = shrines.find(x=> x.id===selectedId);
      if(!s) return;
      if(halo) halo.setData({ type:"FeatureCollection", features:[{ type:"Feature", geometry:{ type:"Point", coordinates:[s.lng, s.lat] }, properties:{} }] } as any);
      map.flyTo({center:[s.lng, s.lat], zoom:19.5, pitch:55, bearing:(Math.random()-0.5)*30, duration:2400, essential:true});
      prevSelectedRef.current = selectedId;
    } else if(prevSelectedRef.current){
      if(halo) halo.setData({ type:"FeatureCollection", features:[] } as any);
      map.flyTo({center:[18, 14], zoom:1.8, pitch:52, bearing:-8, duration:1800, essential:true});
      prevSelectedRef.current = null;
    }
  },[selectedId, shrines]);

  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    const updateClusterData = ()=>{
      const geojson = {
        type:"FeatureCollection" as const,
        features: shrines.map(s=> ({
          type:"Feature" as const,
          geometry:{ type:"Point" as const, coordinates:[s.lng, s.lat] },
          properties:{ id:s.id, city:s.city, handle:s.handle, line:s.line, image:s.image }
        }))
      };
      const src = map.getSource("shrines") as any;
      if(src) src.setData(geojson as any);
    };
    // use clustering for 500+ shrines — accurate, no sea, every continent
    const setupCluster = ()=>{
      if(map.getSource("shrines")) return;
      map.addSource("shrines", {
        type:"geojson",
        data:{
          type:"FeatureCollection",
          features: shrines.map(s=> ({
            type:"Feature", geometry:{type:"Point", coordinates:[s.lng, s.lat]}, properties:{id:s.id}
          }))
        } as any,
        cluster:true, clusterMaxZoom:14, clusterRadius:50
      } as any);
      // human-figure marker sprite — drawn once, white figure / red ring
      if(!map.hasImage("person")){
        const c = document.createElement("canvas"); c.width = 44; c.height = 44;
        const g = c.getContext("2d")!;
        g.beginPath(); g.arc(22, 13, 7.5, 0, Math.PI*2);
        g.fillStyle = "#ffffff"; g.fill();
        g.lineWidth = 3; g.strokeStyle = "#ff3b30"; g.stroke();
        g.beginPath();
        g.moveTo(22, 22);
        g.arc(22, 22, 11, Math.PI, 0);
        g.lineTo(33, 40); g.lineTo(11, 40); g.closePath();
        g.fillStyle = "#ffffff"; g.fill();
        g.lineWidth = 3; g.strokeStyle = "#ff3b30"; g.stroke();
        map.addImage("person", { width: 44, height: 44, data: g.getImageData(0, 0, 44, 44).data } as any);
      }
      map.addLayer({
        id:"clusters-halo",
        type:"circle",
        source:"shrines",
        filter:["has","point_count"],
        paint:{
          "circle-color":"#ff3b30",
          "circle-radius":["step",["get","point_count"],20,10,24,30,30],
          "circle-opacity":0.22,
          "circle-blur":0.6
        }
      } as any);
      map.addLayer({
        id:"clusters",
        type:"circle",
        source:"shrines",
        filter:["has","point_count"],
        paint:{
          "circle-color":["step",["get","point_count"],"#ffffff",10,"#ff3b30",30,"#1a1a1a"],
          "circle-radius":["step",["get","point_count"],13,10,17,30,22],
          "circle-stroke-width":2, "circle-stroke-color":"#ffffff",
          "circle-opacity":0.98
        }
      } as any);
      map.addLayer({
        id:"cluster-count",
        type:"symbol",
        source:"shrines",
        filter:["has","point_count"],
        layout:{"text-field":["get","point_count"], "text-font":["DIN Offc Pro Medium","Arial Unicode MS Bold"], "text-size":11},
        paint:{"text-color":["step",["get","point_count"],"black",10,"white",30,"white"]}
      } as any);
      map.addLayer({
        id:"unclustered-halo",
        type:"circle",
        source:"shrines",
        filter:["!",["has","point_count"]],
        paint:{ "circle-color":"#ff3b30", "circle-radius":11, "circle-opacity":0.3, "circle-blur":0.7 }
      } as any);
      map.addLayer({
        id:"unclustered-point",
        type:"symbol",
        source:"shrines",
        filter:["!",["has","point_count"]],
        layout:{
          "icon-image":"person",
          "icon-size":["interpolate",["linear"],["zoom"],2,0.55,10,0.8,16,1],
          "icon-allow-overlap":true,
          "icon-ignore-placement":true
        }
      } as any);
      // selected halo — pleasing ring around open memory
      if(!map.getSource("selected-halo")){
        map.addSource("selected-halo", { type:"geojson", data:{ type:"FeatureCollection", features:[] } } as any);
        map.addLayer({ id:"selected-halo-glow", type:"circle", source:"selected-halo", paint:{ "circle-color":"#ff3b30", "circle-radius":22, "circle-opacity":0.25, "circle-blur":0.8 } } as any);
        map.addLayer({ id:"selected-halo-ring", type:"circle", source:"selected-halo", paint:{ "circle-color":"transparent", "circle-radius":13, "circle-stroke-width":2.5, "circle-stroke-color":"#ffffff", "circle-opacity":0.95 } } as any);
      }
      map.on("click", "clusters", (e:any)=>{
        const features = map.queryRenderedFeatures(e.point, { layers:["clusters"] });
        if(!features.length || !features[0]) return;
        const clusterId = (features[0] as any).properties.cluster_id;
        (map.getSource("shrines") as any).getClusterExpansionZoom(clusterId, (err:any, zoom:number)=>{
          if(err) return;
          map.easeTo({center:((features[0] as any).geometry as any).coordinates, zoom});
        });
      });
      map.on("click", "unclustered-point", (e:any)=>{
        const f = e.features?.[0]; if(!f) return;
        const s = shrines.find(x=> x.id===f.properties.id);
        if(s){ onSelectRef.current?.(s); onHoverRef.current?.(s.id); map.flyTo({center:[s.lng, s.lat], zoom:19.5, pitch:55, bearing:(Math.random()-0.5)*30, duration:2400, essential:true}); }
      });
      map.on("mouseenter", "clusters", ()=> map.getCanvas().style.cursor="pointer");
      map.on("mouseleave", "clusters", ()=> map.getCanvas().style.cursor="");
      map.on("mouseenter", "unclustered-point", ()=> map.getCanvas().style.cursor="pointer");
      map.on("mouseleave", "unclustered-point", ()=> map.getCanvas().style.cursor="");
    };
    const addMarkers = ()=>{
      // fallback for <100 shrines — keep DOM markers for crisp, else use cluster
      if(shrines.length>120){
        updateClusterData();
        if(!map.getSource("shrines")) setupCluster();
        else updateClusterData();
        // hide old DOM markers
        const existing = (map as any)._shrineMarkers as any[] | undefined;
        existing?.forEach((m:any)=> m.remove());
        return;
      }
      const existing = (map as any)._shrineMarkers as mapboxgl.Marker[] | undefined;
      existing?.forEach((m:any)=> m.remove());
      const markers: any[] = [];
      shrines.forEach(s=>{
        const el = document.createElement("div");
        el.className = "shrine-marker";
        el.style.cssText = `width:14px;height:14px;background:#ff3b30;border:2px solid white;border-radius:999px;box-shadow:0 0 14px rgba(255,59,48,0.9), 0 0 22px rgba(255,59,48,0.35), 0 2px 8px rgba(0,0,0,0.5);display:grid;place-items:center;cursor:pointer;transition:transform 0.15s;`;
        el.innerHTML = `<span style="width:6px;height:6px;background:white;border-radius:999px;display:block;box-shadow:0 0 6px rgba(255,255,255,0.8)"></span>`;
        el.onmouseenter = ()=> onHoverRef.current?.(s.id);
        el.onmouseleave = ()=> onHoverRef.current?.(null);
        el.onclick = (e)=> { e.stopPropagation(); (e as any).preventDefault?.(); onSelectRef.current?.(s); onHoverRef.current?.(s.id); map.flyTo({center:[s.lng, s.lat], zoom:19.5, pitch:55, bearing: (Math.random()-0.5)*30, duration:2400, essential:true}); map.once("moveend", ()=> (map as any)._syncPillars?.()); };
        const m = new mapboxgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
        markers.push(m);
      });
      (map as any)._shrineMarkers = markers;
      (map as any)._syncPillars?.();
      (map as any)._drawConnections?.();
    };
    if(map.isStyleLoaded()) addMarkers();
    else map.once("load", addMarkers);
  },[shrines]);

  const [locModal, setLocModal] = useState<null | { blocked: boolean }>(null);
  const isIOS = ()=> /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator as any).platform==="MacIntel" && navigator.maxTouchPoints>1);
  const doLocate = ()=>{
    const map = mapRef.current; if(!map) return;
    navigator.geolocation.getCurrentPosition(pos=>{
      setLocModal(null);
      map.flyTo({center:[pos.coords.longitude, pos.coords.latitude], zoom:14, pitch:60, duration:1800, essential:true});
    }, (err)=> {
      // iPhones silently block until allowed in settings — coach instead of failing quiet
      if(err.code===1 || isIOS()) setLocModal({ blocked: true });
    }, { timeout:9000, enableHighAccuracy:true });
  };
  const locateMe = ()=>{
    if(!navigator.geolocation) return;
    // iPhone: explain first, then trigger the permission prompt from the tap
    if(isIOS()) setLocModal({ blocked: false });
    else doLocate();
  };
  const resetView = ()=>{
    const map = mapRef.current; if(!map) return;
    map.flyTo({center:[18,14], zoom:1.6, pitch:0, bearing:-8, duration:1600, essential:true});
  };

  return (
    <div className="relative h-full w-full bg-[#0f0f0f]">
      <div ref={ref} className="h-full w-full shrine-grade" />
      {/* cinematic grade + vignette */}
      <div className="pointer-events-none absolute inset-0" style={{background:"radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.42) 100%)"}} />
      {/* right-middle controls — ride the drawer edge when memory open */}
      <div className={`absolute top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 transition-all duration-300 ${selectedId ? "right-3 sm:right-[444px]" : "right-3 sm:right-6"}`}>
        <button onClick={locateMe} title="locate me" className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-white grid place-items-center hover:bg-black/90 active:scale-95"><Location01Icon size={15}/></button>
        <button onClick={resetView} title="reset world" className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-white grid place-items-center hover:bg-black/90 active:scale-95">⟲</button>
      </div>
      {/* iPhone location coaching — strict permissions need a human explanation */}
      {locModal && (
        <div onClick={()=> setLocModal(null)} className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md grid place-items-center p-6">
          <div onClick={e=> e.stopPropagation()} className="w-full max-w-[320px] bg-[#141414] border border-white/10 rounded-[20px] p-5 text-white">
            <div className="w-10 h-10 rounded-xl bg-white text-black grid place-items-center mx-auto"><Location01Icon size={18}/></div>
            <div className="mt-3 text-center font-[family-name:var(--font-serif)] lowercase text-lg">find me on the map</div>
            {locModal.blocked ? (
              <p className="mt-2 text-center font-[family-name:var(--font-grotesk)] text-sm lowercase leading-6 text-white/60">
                iphone blocked location. open settings → privacy & security → location services → on, then allow safari (or this app) → come back and try again.
              </p>
            ) : (
              <p className="mt-2 text-center font-[family-name:var(--font-grotesk)] text-sm lowercase leading-6 text-white/60">
                next your iphone will ask for location — tap allow so we can fly you home.
              </p>
            )}
            <button onClick={doLocate} className="mt-4 w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase text-sm font-medium">try locating me</button>
            <button onClick={()=> setLocModal(null)} className="mt-2 w-full font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
