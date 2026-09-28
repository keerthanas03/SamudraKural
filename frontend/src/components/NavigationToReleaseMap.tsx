import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/colors';

interface NavigationToReleaseMapProps {
  fishermanLat: number;
  fishermanLon: number;
  releaseLat: number;
  releaseLon: number;
  distanceKm: number;
  bearingDeg: number;
  width?: number;
  height?: number;
}

export const NavigationToReleaseMap: React.FC<NavigationToReleaseMapProps> = ({
  fishermanLat,
  fishermanLon,
  releaseLat,
  releaseLon,
  distanceKm,
  bearingDeg,
  width = Dimensions.get('window').width - 48,
  height = 360,
}) => {
  const webViewRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  const routeCoords = [
    [fishermanLat, fishermanLon],
    [releaseLat, releaseLon],
  ];

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #E6F2F5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #004D40;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 2px;
      font-size: 11px;
      font-weight: bold;
    }
    .custom-popup .leaflet-popup-tip {
      background: #004D40;
    }
    .pulse-marker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 8px rgba(0,0,0,0.4);
    }
    .pulse-ring {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      animation: pulsate 2s infinite ease-out;
      opacity: 0;
    }
    @keyframes pulsate {
      0% { transform: scale(0.3); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${fishermanLat}, ${fishermanLon}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var bounds = L.latLngBounds();

    // Route line (Dashed cyan with shadow)
    var routeCoords = ${JSON.stringify(routeCoords)};
    
    L.polyline(routeCoords, {
      color: '#006064',
      weight: 6,
      opacity: 0.4,
      dashArray: '8, 8'
    }).addTo(map);

    var routeLine = L.polyline(routeCoords, {
      color: '#00BCD4',
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 8'
    }).addTo(map);
    bounds.extend(routeLine.getBounds());

    // 1. Green Marker: Current Fisherman Location (Boat)
    var boatIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring" style="border: 2px solid #2ECC71; background: rgba(46,204,113,0.3);"></div><div class="pulse-dot" style="background: #2ECC71;"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    var boatMarker = L.marker([${fishermanLat}, ${fishermanLon}], { icon: boatIcon }).addTo(map);
    boatMarker.bindPopup("<b>👤 Your Current Location (Boat)</b><br>Lat: ${fishermanLat.toFixed(4)}<br>Lon: ${fishermanLon.toFixed(4)}", { className: 'custom-popup' });
    bounds.extend([${fishermanLat}, ${fishermanLon}]);

    // 2. Blue Marker: Original Net Release Point
    var releaseIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring" style="border: 2px solid #2980B9; background: rgba(41,128,185,0.3);"></div><div class="pulse-dot" style="background: #2980B9;"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    var releaseMarker = L.marker([${releaseLat}, ${releaseLon}], { icon: releaseIcon }).addTo(map);
    releaseMarker.bindPopup("<b>📍 Original Net Release Point</b><br>Lat: ${releaseLat.toFixed(4)}<br>Lon: ${releaseLon.toFixed(4)}", { className: 'custom-popup' });
    bounds.extend([${releaseLat}, ${releaseLon}]);

    map.fitBounds(bounds, { padding: [40, 40] });

    window.resetMapBounds = function() {
      map.fitBounds(bounds, { padding: [40, 40] });
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={() => setMapLoaded(true)}
      />

      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.mapLoadingText}>Loading live map...</Text>
        </View>
      )}

      {/* Re-center Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        activeOpacity={0.8}
        onPress={() => {
          webViewRef.current?.injectJavaScript('window.resetMapBounds && window.resetMapBounds(); true;');
        }}
      >
        <Text style={styles.recenterText}>🎯 Center</Text>
      </TouchableOpacity>

      {/* Legend Banner */}
      <View style={styles.legendBanner}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#2ECC71' }]} />
          <Text style={styles.legendTxt}>You (Boat)</Text>
        </View>

        <Text style={styles.distTxt}>📍 {distanceKm.toFixed(2)} km ({bearingDeg.toFixed(0)}°)</Text>

        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#2980B9' }]} />
          <Text style={styles.legendTxt}>Release Point</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B2DFDB',
    backgroundColor: '#E6F2F5',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#E6F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  recenterBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B2DFDB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  recenterText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  legendBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  distTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
});
