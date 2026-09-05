"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Shrine } from "@/lib/shrine-data";

function ClickHandler({ onPick }:{ onPick:(lat:number,lng:number)=>void }){
  useMapEvents({
    click(e){ onPick(e.latlng.lat, e.latlng.lng); }
  });
  return null;
}

// fix leaflet icon urls (not needed for custom dot but keeps leaflet happy)
if (typeof window !== "undefined") {
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function dotIcon(isHovered: boolean) {
  const size = isHovered ? 18 : 12;
  return L.divIcon({
    className: "shrine-dot",
    html: `<span style="
      display:grid;place-items:center;
      width:${size}px;height:${size}px;
      background:${isHovered ? "#ff3b30" : "white"};
      border:2px solid ${isHovered ? "white" : "rgba(0,0,0,0.8)"};
      border-radius:999px;
      box-shadow:0 0 ${isHovered?16:8}px rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.6);
      transition: all 0.15s;
    "><span style="width:6px;height:6px;background:${isHovered?"white":"black"};border-radius:999px;display:block"></span></span>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -10],
  });
}

function InvalidateOnResize(){
  const map = useMap();
  useEffect(()=> {
    setTimeout(()=> map.invalidateSize(), 200);
    const onResize = ()=> map.invalidateSize();
    window.addEventListener("resize", onResize);
    return ()=> window.removeEventListener("resize", onResize);
  },[map]);
  return null;
}

export default function ShrineMap({ shrines, hovered, onHover, onPick } : { shrines: Shrine[], hovered: string|null, onHover: (id:string|null)=>void, onPick?: (lat:number,lng:number)=>void }){
  return (
    <MapContainer
      center={[14, 18]}
      zoom={2.2}
      minZoom={2}
      maxZoom={20}
      scrollWheelZoom={true}
      className="h-[420px] sm:h-[520px] w-full bg-[#0f0f0f]"
      style={{ background: "#0f0f0f" }}
      worldCopyJump
    >
      <InvalidateOnResize/>
      {/* Voyager with key — requested */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_2vm3_1_ecec2a617f933a4befede37f"
        subdomains={["a","b","c","d"]}
        maxZoom={20}
      />
      {onPick && <ClickHandler onPick={onPick} />}
      {shrines.map(s=>(
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={dotIcon(hovered===s.id)}
          eventHandlers={{
            mouseover: ()=> onHover(s.id),
            mouseout: ()=> onHover(null),
            click: ()=> onHover(s.id),
          }}
        >
          <Popup className="shrine-popup" maxWidth={260} minWidth={240}>
            <div style={{ margin: "-2px -2px", fontFamily: "system-ui" }}>
              <img src={s.image} alt="" style={{ width:"100%", height:140, objectFit:"cover", borderRadius:12, display:"block" }}/>
              <div style={{ padding:"10px 2px 2px" }}>
                <div style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", opacity:0.5, fontFamily:"var(--font-grotesk)" }}>{s.city} • @{s.handle}</div>
                <div style={{ fontFamily:"Instrument Serif, serif", fontSize:14, lineHeight:"20px", marginTop:4, textTransform:"lowercase"}}>“{s.line}”</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
