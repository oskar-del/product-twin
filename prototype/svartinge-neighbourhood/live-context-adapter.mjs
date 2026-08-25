const VERSION = "svartinge-live-context-adapter/v0.1";
const MAPBOX_STYLE = "mapbox://styles/mapbox/standard-satellite";
const MAPBOX_TERRAIN_SOURCE = "mapbox-dem";

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function requirePair(value, label) {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${label} must be [longitude, latitude]`);
  value.forEach((number, index) => requireFinite(number, `${label}[${index}]`));
  if (value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) throw new RangeError(`${label} is outside WGS84`);
  return [...value];
}

function requireContainer(value) {
  if (!value || (typeof value !== "string" && typeof value !== "object")) throw new TypeError("container is required");
  return value;
}

function requireRuntimeToken(value) {
  if (typeof value !== "string" || value.trim().length < 8) throw new TypeError("a runtime Mapbox public token is required");
  return value.trim();
}

export function createMapboxRuntimeAdapter({
  mapboxgl,
  publicToken,
  container,
  originWgs84,
  onState = () => {}
}) {
  if (!mapboxgl || typeof mapboxgl.Map !== "function") throw new TypeError("mapboxgl runtime is required");
  const token = requireRuntimeToken(publicToken);
  const target = requireContainer(container);
  const origin = requirePair(originWgs84, "originWgs84");
  if (typeof onState !== "function") throw new TypeError("onState must be a function");

  let map = null;
  let phase = "READY_TO_MOUNT";
  const descriptor = Object.freeze({
    version: VERSION,
    provider_id: "MAPBOX_STANDARD_SATELLITE",
    evidence_role: "LIVE_VISUAL_CONTEXT",
    evidence_promotion_allowed: false,
    storage_policy: "LIVE_ONLY_NO_PERSISTENCE",
    attribution_required: true,
    runtime_token_cleared_on_destroy: true,
    origin_wgs84: Object.freeze([...origin])
  });

  const emit = (next, detail = null) => {
    phase = next;
    onState(Object.freeze({phase, detail, descriptor}));
  };

  const applyView = ({center = origin, zoom, pitch, bearing}) => {
    if (!map) throw new Error("adapter must be mounted before synchronizing a view");
    const nextCenter = requirePair(center, "center");
    const camera = {
      center: nextCenter,
      zoom: requireFinite(zoom, "zoom"),
      pitch: requireFinite(pitch, "pitch"),
      bearing: requireFinite(bearing, "bearing"),
      essential: true
    };
    map.jumpTo(camera);
    return Object.freeze({...camera, center: Object.freeze([...nextCenter])});
  };

  return Object.freeze({
    descriptor,
    get phase() {
      return phase;
    },
    mount() {
      if (map) return map;
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: target,
        style: MAPBOX_STYLE,
        center: origin,
        zoom: 17.2,
        pitch: 58,
        bearing: 0,
        antialias: true,
        attributionControl: true,
        preserveDrawingBuffer: false
      });
      emit("LOADING");
      map.on("load", () => {
        if (!map.getSource(MAPBOX_TERRAIN_SOURCE)) {
          map.addSource(MAPBOX_TERRAIN_SOURCE, {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14
          });
        }
        map.setTerrain({source: MAPBOX_TERRAIN_SOURCE, exaggeration: 1});
        emit("CONNECTED", "Live provider context loaded; spatial evidence state is unchanged.");
      });
      map.on("error", (event) => emit("ERROR", event?.error?.message ?? "Provider context error"));
      return map;
    },
    syncView({center = origin, zoom, pitch, bearing}) {
      return applyView({center, zoom, pitch, bearing});
    },
    syncStage(stage) {
      if (!stage || typeof stage !== "object") throw new TypeError("stage is required");
      const view = stage.live_context_view;
      if (!view || view.evidence_effect !== "NONE") throw new Error("stage must preserve a NONE live-context evidence effect");
      if (view.synchronization !== "LOCAL_EAST_UP_NORTH_STAGE_REFERENCE") throw new Error("stage live-context synchronization contract is invalid");
      return applyView({center: view.center_wgs84, zoom: view.zoom, pitch: view.pitch, bearing: view.bearing});
    },
    destroy() {
      if (map) map.remove();
      map = null;
      if (mapboxgl.accessToken === token) mapboxgl.accessToken = "";
      emit("DESTROYED");
    }
  });
}

export const liveContextContract = Object.freeze({
  version: VERSION,
  activation: "EXPLICIT_RUNTIME_CONFIG_ONLY",
  accepted_provider: "MAPBOX_STANDARD_SATELLITE",
  accepted_origin_crs: "EPSG:4326_LONGITUDE_LATITUDE",
  credential_persistence: false,
  tile_persistence: false,
  runtime_token_cleared_on_destroy: true,
  evidence_promotion_allowed: false,
  attribution_required: true
});
