/**
 * NAQAL GO - Map picker component (WebView + Leaflet, dark theme, works without Google API key)
 */
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
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
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
    font-size: 18px;
    border: 2px solid ${colors.appBg};
  }
  .pin-pickup { background: ${colors.gold}; color: ${colors.appBg}; }
  .pin-dropoff { background: #FF453A; color: #fff; }
  .pin-driver { background: #34C759; color: #fff; }
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
      iconSize: [36,36], iconAnchor: [18,18]
    });
  }

  function sendMsg(payload){
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
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
      routeLine = L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color: '${colors.gold}', weight: 4, dashArray: '8 6' }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [60,60] });
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
