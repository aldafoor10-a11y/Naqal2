/**
 * NAQAL GO - Map picker component (WebView + Leaflet, dark theme, works without Google API key)
 */
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '@/src/theme';

export type LatLng = { latitude: number; longitude: number };

export type MapPickerProps = {
  initialCenter?: LatLng;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  activeMode?: 'pickup' | 'dropoff';
  onLocationPicked?: (mode: 'pickup' | 'dropoff', loc: LatLng) => void;
  showRoute?: boolean;
  driverLocation?: LatLng | null;
  interactive?: boolean;
};

export type MapPickerHandle = {
  setCenter: (loc: LatLng, zoom?: number) => void;
  setMarker: (mode: 'pickup' | 'dropoff', loc: LatLng) => void;
};

const DEFAULT_CENTER: LatLng = { latitude: 36.345, longitude: 43.1450 }; // Mosul, Iraq

const buildHtml = (center: LatLng) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${colors.appBg}; }
  .leaflet-container { background: ${colors.appBg}; }
  .pin {
    width: 44px; height: 44px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.7), 0 0 0 4px rgba(13,9,7,0.6);
    font-size: 18px; font-weight: 700;
    border: 3px solid ${colors.appBg};
    transition: transform 0.2s ease;
  }
  .pin:active { transform: scale(1.15); }
  .pin-pickup {
    background: linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%);
    color: ${colors.appBg};
  }
  .pin-dropoff {
    background: linear-gradient(135deg, #FF6B5C 0%, #C73A2F 100%);
    color: #fff;
  }
  .pin-driver {
    background: linear-gradient(135deg, #4CD964 0%, #2E9E45 100%);
    color: #fff;
  }
  .pulse {
    position: absolute;
    width: 44px; height: 44px;
    border-radius: 50%;
    background: ${colors.gold};
    opacity: 0.4;
    animation: pulse 2s infinite;
    pointer-events: none;
  }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.4; }
    100% { transform: scale(2.5); opacity: 0; }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${center.latitude}, ${center.longitude}], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

  var pickupMarker = null;
  var dropoffMarker = null;
  var driverMarker = null;
  var routeLine = null;
  var activeMode = 'pickup';

  function makeIcon(kind, label){
    return L.divIcon({
      className: '',
      html: '<div class="pin pin-'+kind+'">'+label+'</div>',
      iconSize: [44,44], iconAnchor: [22,22]
    });
  }

  function sendMsg(payload){
    var s = JSON.stringify(payload);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(s);
    }
    // Web iframe bridge: relay to parent window
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage(s, '*'); } catch(e){}
    }
  }

  function setPickup(lat, lng){
    if (pickupMarker) pickupMarker.setLatLng([lat,lng]);
    else pickupMarker = L.marker([lat,lng], { icon: makeIcon('pickup','A'), draggable: true }).addTo(map);
    pickupMarker.off('dragend');
    pickupMarker.on('dragend', function(e){
      var p = e.target.getLatLng();
      sendMsg({ type: 'marker', mode: 'pickup', latitude: p.lat, longitude: p.lng });
      drawRoute();
    });
    drawRoute();
  }

  function setDropoff(lat, lng){
    if (dropoffMarker) dropoffMarker.setLatLng([lat,lng]);
    else dropoffMarker = L.marker([lat,lng], { icon: makeIcon('dropoff','B'), draggable: true }).addTo(map);
    dropoffMarker.off('dragend');
    dropoffMarker.on('dragend', function(e){
      var p = e.target.getLatLng();
      sendMsg({ type: 'marker', mode: 'dropoff', latitude: p.lat, longitude: p.lng });
      drawRoute();
    });
    drawRoute();
  }

  function setDriver(lat, lng){
    if (driverMarker) driverMarker.setLatLng([lat,lng]);
    else driverMarker = L.marker([lat,lng], { icon: makeIcon('driver','🚚') }).addTo(map);
  }

  function drawRoute(){
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (pickupMarker && dropoffMarker) {
      var a = pickupMarker.getLatLng();
      var b = dropoffMarker.getLatLng();
      // Outer glow line
      L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color: '${colors.gold}', weight: 8, opacity: 0.2 }).addTo(map);
      routeLine = L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color: '${colors.gold}', weight: 4, dashArray: '10 6', opacity: 0.95 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [80,80], maxZoom: 14 });
    }
  }

  function setCenter(lat, lng, zoom){
    map.setView([lat,lng], zoom || 14);
  }

  map.on('click', function(e){
    if (activeMode === 'pickup') {
      setPickup(e.latlng.lat, e.latlng.lng);
      sendMsg({ type: 'marker', mode: 'pickup', latitude: e.latlng.lat, longitude: e.latlng.lng });
    } else {
      setDropoff(e.latlng.lat, e.latlng.lng);
      sendMsg({ type: 'marker', mode: 'dropoff', latitude: e.latlng.lat, longitude: e.latlng.lng });
    }
  });

  window.addEventListener('message', function(ev){
    try {
      var data = JSON.parse(ev.data);
      if (data.type === 'setActive') activeMode = data.mode;
      if (data.type === 'setPickup') setPickup(data.latitude, data.longitude);
      if (data.type === 'setDropoff') setDropoff(data.latitude, data.longitude);
      if (data.type === 'setDriver') setDriver(data.latitude, data.longitude);
      if (data.type === 'setCenter') setCenter(data.latitude, data.longitude, data.zoom);
    } catch(e){}
  });
  // For Android - inject also calls document
  document.addEventListener('message', function(ev){
    try {
      var data = JSON.parse(ev.data);
      if (data.type === 'setActive') activeMode = data.mode;
      if (data.type === 'setPickup') setPickup(data.latitude, data.longitude);
      if (data.type === 'setDropoff') setDropoff(data.latitude, data.longitude);
      if (data.type === 'setDriver') setDriver(data.latitude, data.longitude);
      if (data.type === 'setCenter') setCenter(data.latitude, data.longitude, data.zoom);
    } catch(e){}
  });

  sendMsg({ type: 'ready' });
</script>
</body>
</html>`;

const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(function MapPicker(props, ref) {
  const {
    initialCenter = DEFAULT_CENTER,
    pickup,
    dropoff,
    activeMode = 'pickup',
    onLocationPicked,
    driverLocation,
  } = props;

  const webRef = useRef<WebView | null>(null);
  const [isReady, setIsReady] = useState(false);

  const post = useCallback((payload: any) => {
    const js = `(function(){ try { window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(
      JSON.stringify(payload)
    )}})); } catch(e){} true; })();`;
    webRef.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(ref, () => ({
    setCenter: (loc, zoom) => post({ type: 'setCenter', ...loc, zoom }),
    setMarker: (mode, loc) =>
      post({ type: mode === 'pickup' ? 'setPickup' : 'setDropoff', ...loc }),
  }));

  // Apply props after ready
  React.useEffect(() => {
    if (!isReady) return;
    post({ type: 'setActive', mode: activeMode });
    if (pickup) post({ type: 'setPickup', ...pickup });
    if (dropoff) post({ type: 'setDropoff', ...dropoff });
    if (driverLocation) post({ type: 'setDriver', ...driverLocation });
  }, [isReady, activeMode, pickup, dropoff, driverLocation, post]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === 'ready') setIsReady(true);
        if (data.type === 'marker' && onLocationPicked) {
          onLocationPicked(data.mode, { latitude: data.latitude, longitude: data.longitude });
        }
      } catch {}
    },
    [onLocationPicked]
  );

  if (Platform.OS === 'web') {
    return (
      <WebMap
        initialCenter={initialCenter}
        pickup={pickup}
        dropoff={dropoff}
        activeMode={activeMode}
        driverLocation={driverLocation}
        onLocationPicked={onLocationPicked}
      />
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: buildHtml(initialCenter) }}
        onMessage={onMessage}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.gold} size="large" />
          </View>
        )}
      />
    </View>
  );
});

/** Web-only map using an iframe with the same Leaflet HTML. */
function WebMap({
  initialCenter,
  pickup,
  dropoff,
  activeMode,
  driverLocation,
  onLocationPicked,
}: MapPickerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const post = useCallback((payload: any) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type === 'ready') setReady(true);
        if (data?.type === 'marker' && onLocationPicked) {
          onLocationPicked(data.mode, { latitude: data.latitude, longitude: data.longitude });
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLocationPicked]);

  useEffect(() => {
    if (!ready) return;
    post({ type: 'setActive', mode: activeMode });
    if (pickup) post({ type: 'setPickup', ...pickup });
    if (dropoff) post({ type: 'setDropoff', ...dropoff });
    if (driverLocation) post({ type: 'setDriver', ...driverLocation });
  }, [ready, activeMode, pickup, dropoff, driverLocation, post]);

  const html = buildHtml(initialCenter || DEFAULT_CENTER);
  const srcDoc = html;

  return (
    <View style={styles.container}>
      {/* @ts-ignore - iframe is web only */}
      <iframe
        ref={iframeRef as any}
        srcDoc={srcDoc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: colors.appBg,
        }}
        title="map"
      />
    </View>
  );
}

export default MapPicker;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  webview: { flex: 1, backgroundColor: colors.appBg },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.appBg,
  },
});
