export interface Shrine {
  id: string;
  image: string; // cover = images[0]
  images?: string[]; // up to 3
  line: string;
  city: string;
  lat: number;
  lng: number;
  handle: string;
  createdAt: number;
}

export interface ShrineComment {
  id: string;
  memory_id: string;
  handle: string;
  text: string;
  createdAt: number;
}

// 40+ locations — every continent, every major country — to fill world, not just 16 cities
export const CITIES: {name:string, lat:number, lng:number, spread:number, biasLat:number}[] = [
  // Africa
  {name:"lagos", lat:6.5244, lng:3.3792, spread:2.2, biasLat:0.6},
  {name:"abuja", lat:9.0579, lng:7.4951, spread:2.5, biasLat:0.3},
  {name:"accra", lat:5.6037, lng:-0.1870, spread:1.8, biasLat:0.4},
  {name:"nairobi", lat:-1.2921, lng:36.8219, spread:2.0, biasLat:0.2},
  {name:"cape town", lat:-33.9249, lng:18.4241, spread:1.6, biasLat:0.3},
  {name:"johannesburg", lat:-26.2041, lng:28.0473, spread:1.8, biasLat:0.2},
  {name:"cairo", lat:30.0444, lng:31.2357, spread:1.6, biasLat:0.2},
  {name:"casablanca", lat:33.5731, lng:-7.5898, spread:1.6, biasLat:0.2},
  {name:"addis ababa", lat:9.03, lng:38.74, spread:1.6, biasLat:0.2},
  {name:"dakar", lat:14.7167, lng:-17.4677, spread:1.4, biasLat:0.3},
  // Europe
  {name:"london", lat:51.5072, lng:-0.1276, spread:1.4, biasLat:0.1},
  {name:"paris", lat:48.8566, lng:2.3522, spread:1.4, biasLat:0.1},
  {name:"berlin", lat:52.52, lng:13.405, spread:1.6, biasLat:0.1},
  {name:"rome", lat:41.9028, lng:12.4964, spread:1.4, biasLat:0.1},
  {name:"madrid", lat:40.4168, lng:-3.7038, spread:1.4, biasLat:0.1},
  {name:"amsterdam", lat:52.3676, lng:4.9041, spread:1.2, biasLat:0.1},
  {name:"warsaw", lat:52.2297, lng:21.0122, spread:1.4, biasLat:0.1},
  {name:"istanbul", lat:41.0082, lng:28.9784, spread:1.4, biasLat:0.2},
  // Asia
  {name:"dubai", lat:25.2048, lng:55.2708, spread:1.2, biasLat:0.1},
  {name:"mumbai", lat:19.076, lng:72.8777, spread:1.8, biasLat:0.2},
  {name:"delhi", lat:28.7041, lng:77.1025, spread:1.6, biasLat:0.1},
  {name:"tokyo", lat:35.6762, lng:139.6503, spread:1.2, biasLat:0.1},
  {name:"seoul", lat:37.5665, lng:126.978, spread:1.2, biasLat:0.1},
  {name:"beijing", lat:39.9042, lng:116.4074, spread:1.6, biasLat:0.1},
  {name:"bangkok", lat:13.7563, lng:100.5018, spread:1.4, biasLat:0.1},
  {name:"singapore", lat:1.3521, lng:103.8198, spread:0.6, biasLat:0.05},
  {name:"jakarta", lat:-6.2088, lng:106.8456, spread:1.4, biasLat:0.1},
  // North America
  {name:"nyc", lat:40.7128, lng:-74.006, spread:1.6, biasLat:0.1},
  {name:"los angeles", lat:34.0522, lng:-118.2437, spread:1.4, biasLat:0.1},
  {name:"chicago", lat:41.8781, lng:-87.6298, spread:1.4, biasLat:0.1},
  {name:"toronto", lat:43.6532, lng:-79.3832, spread:1.4, biasLat:0.1},
  {name:"mexico city", lat:19.4326, lng:-99.1332, spread:1.6, biasLat:0.1},
  // South America
  {name:"sao paulo", lat:-23.5505, lng:-46.6333, spread:1.6, biasLat:-0.1},
  {name:"buenos aires", lat:-34.6037, lng:-58.3816, spread:1.4, biasLat:-0.1},
  {name:"bogota", lat:4.711, lng:-74.0721, spread:1.4, biasLat:0.1},
  {name:"lima", lat:-12.0464, lng:-77.0428, spread:1.4, biasLat:0.1},
  {name:"santiago", lat:-33.4489, lng:-70.6693, spread:1.4, biasLat:-0.1},
  // Oceania
  {name:"sydney", lat:-33.8688, lng:151.2093, spread:1.2, biasLat:-0.1},
  {name:"melbourne", lat:-37.8136, lng:144.9631, spread:1.2, biasLat:-0.1},
  {name:"auckland", lat:-36.8509, lng:174.7645, spread:1.0, biasLat:-0.05},
];

const LINES = [
  "first kiss in the rain outside that buka — never washed that shirt",
  "dad taught me to ride here, i still hear his hold steady",
  "3am voice note i never sent — still in drafts",
  "where i got the call — got the job, cried on that bench",
  "our song played here, now i avoid this street",
  "midnight walk after breakup — city felt empty except this light",
  "where we danced at that wedding — my shoes still have that dirt",
  "first apartment key, door doesn't exist anymore",
  "hospital bench — waited 8 hours, learned what waiting means",
  "market where mama bought my school shoes every year",
  "rooftop where we planned to leave and never did",
  "bus stop where i waited 2 hours and decided to stay",
  "beach where i buried the letter i was too scared to send",
  "cafe where i wrote the draft that changed everything",
  "street where i got lost and found the better route",
  "where i said yes when i meant no",
  "where i finally said no",
  "where i learned to be alone and liked it",
  "where we laughed until security told us to leave",
  "where i bought the nokia that still has his sms",
];

const IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
  "https://images.unsplash.com/photo-1496483353456-90997957cf99?w=400&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&q=80",
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&q=80",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=80",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=80",
  "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&q=80",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400&q=80",
  "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&q=80",
];

function seededRand(seed:number){ const x=Math.sin(seed*9999)*10000; return x - Math.floor(x); }

const BASE_TIME = new Date("2026-01-15T12:00:00Z").getTime();
export const SEED_SHRINES: Shrine[] = (()=> {
  const base: Shrine[] = [];
  const handles = ["zainab","chidi","nana","kofi","thandi","emma","liam","yuki","amara","david","sara","kwame","aisha","john","maria","ahmed","fatima","ken","priya","omar","sofia","lucas","mei","oscar","tunde","chioma","blessing","emeka","ngozi","yusuf","hassan","bisi","funmi","segun","ada","chiamaka","ife","tope","yemi","sade","kola","fola","dapo","bola","titi","wale","kunle","ayo","bayo","lina","carlos","sofia","hans","yuri","aiko","chen","luca","anna","mohammed","olivia","noah","ava","isabella","james2","mike","sarah2"];
  let idCounter=0;
  for(const c of CITIES){
    for(let j=0;j<32;j++){
      const seed = idCounter*100 + j;
      const li = Math.floor(seededRand(seed*5+2)*LINES.length);
      const ii = Math.floor(seededRand(seed*7+3)*IMAGES.length);
      const hi = Math.floor(seededRand(seed*11+4)*handles.length);
      const line = LINES[li];
      const img = IMAGES[ii];
      const h = handles[hi];
      // spread across country, bias inland to avoid sea
      const dLat = (seededRand(seed*13+5)-0.5)*c.spread*1.4 + c.biasLat;
      const dLng = (seededRand(seed*17+6)-0.5)*c.spread*1.4;
      // clamp sea for coastal: ensure not too far south into ocean for coastal cities
      let lat = c.lat + dLat;
      let lng = c.lng + dLng;
      // simple sea guard: for lagos/accra/dakar, lat < 4.5 is sea — clamp north
      if(["lagos","accra","dakar","cape town","singapore","jakarta","sydney"].includes(c.name) && lat < c.lat - c.spread*0.2){
        lat = c.lat + Math.abs(dLat)*0.5;
      }
      const hrs = Math.floor(seededRand(seed*19+7)*720)+1;
      base.push({
        id: `s${idCounter+1}`,
        image: img,
        line,
        city: c.name,
        lat, lng,
        handle: h,
        createdAt: BASE_TIME - hrs*3600000,
      });
      idCounter++;
    }
  }
  return base;
})();
