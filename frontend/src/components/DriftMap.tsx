import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/colors';
import { TrajectoryPoint, SearchArea } from '../types/net';

interface DriftMapProps {
  points: TrajectoryPoint[];
  searchArea: SearchArea;
  releaseLat: number;
  releaseLon: number;
  fishermanLat?: number;
  fishermanLon?: number;
  width?: number;
  height?: number;
}

export const DriftMap: React.FC<DriftMapProps> = ({
  points,
  searchArea,
  releaseLat,
  releaseLon,
  fishermanLat,
  fishermanLon,
  width = Dimensions.get('window').width - 32,
  height,
}) => {
  const webViewRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [isMapUnlocked, setIsMapUnlocked] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Expanded tall height for panoramic navigation
  const activeHeight = height || (isExpanded ? 640 : 500);

  if (!points || points.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }]}>
        <Text style={styles.emptyText}>Map data unavailable</Text>
      </View>
    );
  }

  // Trajectory coordinates array for Leaflet: [[lat, lon], ...]
  const trajCoords = points.map((p) => [p.latitude, p.longitude]);

  // Intermediate checkpoints
  const checkpoints = points.map((p, idx) => ({
    lat: p.latitude,
    lon: p.longitude,
    step: p.step_number,
    time: p.prediction_time_ist,
    dist: p.cumulative_distance_km,
    speed: p.drift_speed_mps,
    dir: p.drift_direction_cardinal,
    isRelease: idx === 0,
    isFinal: idx === points.length - 1,
  }));

  const radiusMeters = (searchArea.uncertainty_radius_km || 1.2) * 1000;
  const searchCenterLat = searchArea.center_latitude || points[points.length - 1]?.latitude || releaseLat;
  const searchCenterLon = searchArea.center_longitude || points[points.length - 1]?.longitude || releaseLon;
  const totalMovementKm = points[points.length - 1]?.cumulative_distance_km || 0;
  const likelyDir = points[points.length - 1]?.drift_direction_cardinal || 'Northeast';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #001F2D;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: manipulation;
    }
    .leaflet-control-attribution {
      display: none !important;
    }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
      background: #FFFFFF !important;
      color: #0F172A !important;
      border: 2px solid #00A896 !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 24px rgba(0,31,45,0.25) !important;
    }
    .leaflet-popup-content {
      margin: 10px 14px !important;
      line-height: 1.5 !important;
      font-size: 12.5px !important;
    }
    .popup-title {
      font-weight: 900 !important;
      color: #0D7C78 !important;
      font-size: 14.5px !important;
      margin-bottom: 4px !important;
    }
    .popup-sub {
      color: #475569 !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
    }
    .popup-val {
      color: #0F172A !important;
      font-weight: 800 !important;
    }

    /* Floating Navigation Controls */
    .floating-nav-bar {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nav-btn {
      width: 38px;
      height: 38px;
      background: #FFFFFF;
      color: #0D2526;
      border: 1.5px solid #00A896;
      border-radius: 10px;
      font-size: 20px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
    }
    .nav-btn:active {
      background: #E0F2F1;
      transform: scale(0.95);
    }

    .floating-layer-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      border: 1.5px solid #00A896;
      border-radius: 9px;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 800;
      color: #064E3B;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      cursor: pointer;
    }

    /* Pulse Markers */
    .pulse-marker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    .pulse-ring {
      position: absolute;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      animation: pulsate 2.2s infinite ease-out;
      opacity: 0;
      pointer-events: none;
    }
    @keyframes pulsate {
      0% { transform: scale(0.4); opacity: 0.95; }
      100% { transform: scale(1.5); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="floating-nav-bar">
    <div class="nav-btn" onclick="map.zoomIn()" title="Zoom In">+</div>
    <div class="nav-btn" onclick="map.zoomOut()" title="Zoom Out">−</div>
    <div class="nav-btn" style="font-size:16px;" onclick="resetMapBounds()" title="Recenter Map">🎯</div>
  </div>

  <div class="floating-layer-btn" onclick="toggleMapTileLayer()">
    <span id="layerIcon">🛰️</span> <span id="layerText">Satellite</span>
  </div>

  <script>
    var map = L.map('map', {
      zoomControl: false,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      dragging: true,
      tap: true,
      tapTolerance: 15,
      inertia: true,
      inertiaDeceleration: 2500,
      attributionControl: false
    }).setView([${releaseLat}, ${releaseLon}], 13);

    // High-Resolution Satellite Layer & OpenStreetMap Layer
    var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      minZoom: 3
    }).addTo(map);

    var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    });

    var isSatelliteActive = true;
    window.toggleMapTileLayer = function() {
      if (isSatelliteActive) {
        map.removeLayer(satLayer);
        osmLayer.addTo(map);
        document.getElementById('layerIcon').innerText = '🗺️';
        document.getElementById('layerText').innerText = 'Streets';
        isSatelliteActive = false;
      } else {
        map.removeLayer(osmLayer);
        satLayer.addTo(map);
        document.getElementById('layerIcon').innerText = '🛰️';
        document.getElementById('layerText').innerText = 'Satellite';
        isSatelliteActive = true;
      }
    };

    var bounds = L.latLngBounds();

    // 1. Probable Search Area (Yellow semi-transparent circle)
    var searchCircle = L.circle([${searchCenterLat}, ${searchCenterLon}], {
      radius: ${radiusMeters},
      color: '#F59E0B',
      weight: 3,
      dashArray: '6, 6',
      fillColor: '#FBBF24',
      fillOpacity: 0.28
    }).addTo(map);

    searchCircle.bindPopup("<div class='popup-title'>🎯 Predicted Search Area</div><div class='popup-sub'>Radius: <span class='popup-val'>±${(searchArea.uncertainty_radius_km || 1.2).toFixed(1)} km</span><br>${searchArea.sector_description}</div>");
    bounds.extend(searchCircle.getBounds());

    // 2. Trajectory Polyline (Cyan Glow)
    var trajCoords = ${JSON.stringify(trajCoords)};
    
    // Polyline glow shadow
    L.polyline(trajCoords, {
      color: '#005F60',
      weight: 8,
      opacity: 0.6,
      lineCap: 'round'
    }).addTo(map);

    // Main Polyline
    var polyline = L.polyline(trajCoords, {
      color: '#00F5D4',
      weight: 4.5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    bounds.extend(polyline.getBounds());

    // 3. Intermediate Checkpoint markers
    var checkpoints = ${JSON.stringify(checkpoints)};
    checkpoints.forEach(function(cp) {
      if (!cp.isRelease && !cp.isFinal) {
        var marker = L.circleMarker([cp.lat, cp.lon], {
          radius: 5,
          fillColor: '#00F5D4',
          color: '#FFFFFF',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
        marker.bindPopup("<div class='popup-title'>⏱️ Step " + cp.step + " (" + cp.time + ")</div><div class='popup-sub'>Traveled: <span class='popup-val'>+" + cp.dist + " km " + cp.dir + "</span><br>Current Speed: <span class='popup-val'>" + cp.speed.toFixed(2) + " m/s</span></div>");
      }
    });

    // 4. Blue Marker: Original Net Release Point
    var releaseIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring" style="border: 2.5px solid #38BDF8; background: rgba(56,189,248,0.25);"></div><div class="pulse-dot" style="background: #0284C7; color:#FFF;">⚓</div>',
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
    var releaseMarker = L.marker([${releaseLat}, ${releaseLon}], { icon: releaseIcon }).addTo(map);
    releaseMarker.bindPopup("<div class='popup-title'>⚓ Original Net Release Point</div><div class='popup-sub'>Coords: <span class='popup-val'>${releaseLat.toFixed(4)}° N, ${releaseLon.toFixed(4)}° E</span><br>Status: Deployed Initial Anchor</div>");
    bounds.extend([${releaseLat}, ${releaseLon}]);

    // 5. Predicted Endpoint Marker (Target Pin)
    var finalCp = checkpoints[checkpoints.length - 1];
    if (finalCp) {
      var endIcon = L.divIcon({
        className: 'pulse-marker',
        html: '<div class="pulse-ring" style="border: 2.5px solid #F59E0B; background: rgba(245,158,11,0.3);"></div><div class="pulse-dot" style="background: #F59E0B; color:#FFF;">🎯</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });
      var endMarker = L.marker([finalCp.lat, finalCp.lon], { icon: endIcon }).addTo(map);
      endMarker.bindPopup("<div class='popup-title'>🎯 Predicted Net Position</div><div class='popup-sub'>Total Drift: <span class='popup-val'>~" + finalCp.dist + " km " + finalCp.dir + "</span><br>Estimated Time: <span class='popup-val'>" + finalCp.time + "</span></div>");
      bounds.extend([finalCp.lat, finalCp.lon]);
    }

    // 6. Green Marker: Current Fisherman GPS (if available)
    ${
      fishermanLat !== undefined && fishermanLon !== undefined
        ? `
        var fishermanIcon = L.divIcon({
          className: 'pulse-marker',
          html: '<div class="pulse-ring" style="border: 2.5px solid #10B981; background: rgba(16,185,129,0.3);"></div><div class="pulse-dot" style="background: #10B981; color:#FFF;">⛵</div>',
          iconSize: [42, 42],
          iconAnchor: [21, 21]
        });
        var fishermanMarker = L.marker([${fishermanLat}, ${fishermanLon}], { icon: fishermanIcon }).addTo(map);
        fishermanMarker.bindPopup("<div class='popup-title'>⛵ My Boat (Live GPS)</div><div class='popup-sub'>Coords: <span class='popup-val'>${fishermanLat.toFixed(4)}° N, ${fishermanLon.toFixed(4)}° E</span></div>");
        bounds.extend([${fishermanLat}, ${fishermanLon}]);
        `
        : ''
    }

    // Auto-fit bounds
    map.fitBounds(bounds, { padding: [45, 45] });

    // Function to re-center
    window.resetMapBounds = function() {
      map.fitBounds(bounds, { padding: [45, 45] });
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.cardContainer, { width }]}>
      {/* Interactive Mode & Navigation Helper Header */}
      <View style={styles.topControlBar}>
        <View style={styles.headingSummary}>
          <Text style={styles.headingIcon}>🧭</Text>
          <Text style={styles.headingText}>
            ~{totalMovementKm.toFixed(2)} km {likelyDir}
          </Text>
        </View>

        <View style={styles.topControlActions}>
          <TouchableOpacity
            style={[styles.expandToggleBtn, isExpanded ? styles.expandBtnActive : styles.expandBtnInactive]}
            activeOpacity={0.8}
            onPress={() => {
              setIsExpanded(!isExpanded);
              setTimeout(() => {
                webViewRef.current?.injectJavaScript('window.resetMapBounds && window.resetMapBounds(); true;');
              }, 250);
            }}
          >
            <Text style={[styles.expandBtnText, isExpanded ? { color: '#FFFFFF' } : { color: '#0F766E' }]}>
              {isExpanded ? '🗕 Normal' : '⛶ Extend Map'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.lockToggleBtn, isMapUnlocked ? styles.lockBtnActive : styles.lockBtnInactive]}
            activeOpacity={0.8}
            onPress={() => setIsMapUnlocked(!isMapUnlocked)}
          >
            <Text style={styles.lockBtnText}>
              {isMapUnlocked ? '🔓 Active' : '🔒 Scroll'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.mapWrapper, { height: activeHeight }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          nestedScrollEnabled={isMapUnlocked}
          overScrollMode="never"
          scalesPageToFit={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onLoadEnd={() => setMapLoaded(true)}
        />

        {!mapLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.mapLoadingText}>Loading satellite map...</Text>
          </View>
        )}
      </View>

      {/* Map Legend Banner */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
          <Text style={styles.legendLabel}>Release (⚓ Blue)</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#00F5D4' }]} />
          <Text style={styles.legendLabel}>Trajectory (Cyan)</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FBBF24', borderColor: '#F59E0B', borderWidth: 1.5 }]} />
          <Text style={styles.legendLabel}>Search Area (🎯 Yellow)</Text>
        </View>

        {fishermanLat !== undefined && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendLabel}>Boat (⛵ Green)</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#B2DFDB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  headingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headingIcon: {
    fontSize: 14,
  },
  headingText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F766E',
  },
  topControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  expandBtnActive: {
    backgroundColor: '#0D7C78',
    borderColor: '#0A5C59',
  },
  expandBtnInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#99F6E4',
  },
  expandBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lockToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  lockBtnActive: {
    backgroundColor: '#00A896',
    borderColor: '#00897B',
  },
  lockBtnInactive: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  lockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mapWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#001F2D',
  },
  webView: {
    flex: 1,
    backgroundColor: '#001F2D',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#001F2D',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A0ECED',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  emptyContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});

