import React from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { WebView } from 'react-native-webview';
import { SOSAlertItem, RescueMissionItem, RiskZoneItem } from '../services/coastalGuardService';
import { Colors } from '../theme/colors';

interface CoastalGuardMapComponentProps {
  height?: DimensionValue;
  sosAlerts?: SOSAlertItem[];
  missions?: RescueMissionItem[];
  riskZones?: RiskZoneItem[];
  center?: { lat: number; lon: number };
  onSelectSOS?: (sosId: number) => void;
}

export const CoastalGuardMapComponent: React.FC<CoastalGuardMapComponentProps> = ({
  height = 560,
  sosAlerts = [],
  missions = [],
  riskZones = [],
  center = { lat: 13.1250, lon: 80.3500 },
  onSelectSOS,
}) => {
  const generateLeafletHTML = () => {
    const sosJSON = JSON.stringify(sosAlerts);
    const missionsJSON = JSON.stringify(missions);
    const riskZonesJSON = JSON.stringify(riskZones);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { box-sizing: border-box; }
          html, body, #map {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #020C17;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            touch-action: manipulation;
          }

          /* Clean Glassmorphic Popups without emojis */
          .leaflet-popup-content-wrapper {
            background: rgba(11, 37, 69, 0.96) !important;
            backdrop-filter: blur(12px) !important;
            color: #FFFFFF !important;
            border: 1.5px solid #38BDF8 !important;
            border-radius: 14px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6) !important;
            padding: 4px !important;
          }
          .leaflet-popup-tip {
            background: #0B2545 !important;
            border: 1px solid #38BDF8 !important;
          }
          .leaflet-popup-content {
            margin: 10px 12px !important;
            line-height: 1.4;
          }
          .popup-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            padding-bottom: 6px;
            margin-bottom: 8px;
            gap: 8px;
          }
          .popup-title {
            font-size: 13px;
            font-weight: 800;
            color: #FFFFFF;
            letter-spacing: 0.3px;
          }
          .popup-badge {
            font-size: 9px;
            font-weight: 900;
            padding: 2px 7px;
            border-radius: 6px;
            text-transform: uppercase;
          }
          .badge-critical { background: #DC2626; color: #FFFFFF; }
          .badge-patrol { background: #0284C7; color: #FFFFFF; }
          .badge-station { background: #059669; color: #FFFFFF; }
          .popup-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #CBD5E1;
            margin: 3px 0;
            gap: 12px;
          }
          .popup-val { font-weight: 700; color: #F8FAFC; }

          /* Strobe / Blink Animations */
          @keyframes blink-red-strobe {
            0%, 100% {
              background: #EF4444;
              box-shadow: 0 0 14px #EF4444, 0 0 24px rgba(239, 68, 68, 0.95);
              opacity: 1;
              transform: scale(1);
            }
            50% {
              background: #6B1212;
              box-shadow: 0 0 3px rgba(239, 68, 68, 0.2);
              opacity: 0.3;
              transform: scale(0.9);
            }
          }

          @keyframes blink-yellow-strobe {
            0%, 100% {
              background: #F59E0B;
              box-shadow: 0 0 14px #F59E0B, 0 0 24px rgba(245, 158, 11, 0.95);
              opacity: 1;
              transform: scale(1);
            }
            50% {
              background: #683005;
              box-shadow: 0 0 3px rgba(245, 158, 11, 0.2);
              opacity: 0.3;
              transform: scale(0.9);
            }
          }

          /* 1. Red SOS Distress Alert (Blinking Red Dot, No Emoji, No Text) */
          .marker-sos {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 2.5px solid #FFFFFF;
            animation: blink-red-strobe 0.85s ease-in-out infinite;
            cursor: pointer;
          }

          /* 2. Blue Patrol Boat Marker (Pure Blue Dot, No Emoji, No Text) */
          .marker-boat {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #0284C7;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 12px #38BDF8, 0 0 20px rgba(56, 189, 248, 0.8);
            cursor: pointer;
          }

          /* 3. Green Command HQ Marker (Pure Green Dot, No Emoji, No Text) */
          .marker-hq {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #10B981;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 12px #34D399, 0 0 20px rgba(16, 185, 129, 0.8);
            cursor: pointer;
          }

          /* 4. Yellow Risk Zone Centroid Marker (Blinking Yellow Dot, No Emoji, No Text) */
          .marker-risk {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2.5px solid #FFFFFF;
            animation: blink-yellow-strobe 0.85s ease-in-out infinite;
            cursor: pointer;
          }

          /* Styled Leaflet Zoom Controls */
          .leaflet-control-zoom {
            border: none !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5) !important;
            border-radius: 12px !important;
            overflow: hidden;
            margin-top: 14px !important;
            margin-left: 14px !important;
          }
          .leaflet-control-zoom a {
            background: rgba(11, 37, 69, 0.9) !important;
            color: #38BDF8 !important;
            border: 1px solid rgba(56, 189, 248, 0.4) !important;
            width: 34px !important;
            height: 34px !important;
            line-height: 34px !important;
            font-size: 18px !important;
            font-weight: 900 !important;
          }
          .leaflet-control-zoom a:hover {
            background: #1D4E89 !important;
            color: #FFFFFF !important;
          }
          .leaflet-control-attribution { display: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: true,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            dragging: true,
            attributionControl: false
          }).setView([${center.lat}, ${center.lon}], 10);

          // Dedicated High-Resolution Satellite HD Basemap
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18
          }).addTo(map);

          // International Maritime Boundary Lines (IMBL / IBL)
          var iblIndiaSriLanka = [
            [12.0000, 82.2500],
            [11.6667, 81.9167],
            [11.4333, 81.6667],
            [11.1333, 81.4000],
            [10.8333, 81.0667],
            [10.5500, 80.7667],
            [10.0833, 80.0500],
            [9.9500, 79.5833],
            [9.6692, 79.3767],
            [9.3633, 79.5117],
            [9.2167, 79.5333],
            [9.1000, 79.5333],
            [8.8967, 79.4817],
            [8.6667, 79.3033],
            [8.6200, 79.2167],
            [8.5200, 79.0783],
            [8.3700, 78.9233],
            [8.2033, 78.8950],
            [7.5883, 78.7450],
            [7.2533, 78.6467],
            [6.5000, 78.4167],
            [4.7833, 77.0167]
          ];

          var iblIndiaPakistan = [
            [23.6000, 68.0333],
            [23.3500, 67.6667],
            [23.0000, 67.1667],
            [22.5000, 66.5000],
            [21.8333, 65.5000],
            [20.8333, 64.0000]
          ];

          var iblIndiaBangladesh = [
            [21.6500, 89.1333],
            [21.1500, 89.2500],
            [20.5000, 89.3667],
            [19.5000, 89.5833],
            [18.0000, 89.8333]
          ];

          var iblIndiaMyanmar = [
            [14.2500, 93.4667],
            [14.0000, 93.6667],
            [13.8000, 93.8333]
          ];

          var iblIndiaIndonesia = [
            [6.6333, 93.3333],
            [6.3333, 93.8333],
            [6.0000, 94.5000]
          ];

          var guardBoundaries = [
            { coords: iblIndiaSriLanka, title: '🚨 INDIA - SRI LANKA IMBL', desc: '1974/1976 Bilateral Maritime Boundary' },
            { coords: iblIndiaPakistan, title: '🚨 INDIA - PAKISTAN IMBL', desc: 'Sir Creek & Arabian Sea IMBL' },
            { coords: iblIndiaBangladesh, title: '🚨 INDIA - BANGLADESH IMBL', desc: 'Bay of Bengal ITLOS 2014 Boundary' },
            { coords: iblIndiaMyanmar, title: '🚨 INDIA - MYANMAR BOUNDARY', desc: 'Coco Channel Boundary Line' },
            { coords: iblIndiaIndonesia, title: '🚨 INDIA - INDONESIA IMBL', desc: 'Great Channel Maritime Border' }
          ];

          guardBoundaries.forEach(function(b) {
            L.polyline(b.coords, {
              color: '#EF4444',
              weight: 3.5,
              dashArray: '8, 6',
              opacity: 0.95
            }).addTo(map).bindPopup('<b>' + b.title + '</b><br/>' + b.desc);
          });

          const sosList = ${sosJSON};
          const missionList = ${missionsJSON};
          const zones = ${riskZonesJSON};

          // 1. Draw Yellow Risk Zones (Yellow Polygon + Pure Yellow Blinking Symbol)
          zones.forEach(zone => {
            if (zone.coordinates && zone.coordinates.length > 0) {
              const polyCoords = zone.coordinates.map(c => [c.lat, c.lon]);
              L.polygon(polyCoords, {
                color: '#F59E0B',
                fillColor: '#F59E0B',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '6, 6'
              }).addTo(map);

              const avgLat = zone.coordinates.reduce((sum, c) => sum + c.lat, 0) / zone.coordinates.length;
              const avgLon = zone.coordinates.reduce((sum, c) => sum + c.lon, 0) / zone.coordinates.length;

              const yellowIcon = L.divIcon({
                className: 'risk-symbol',
                html: '<div class="marker-risk"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });

              L.marker([avgLat, avgLon], { icon: yellowIcon }).addTo(map).bindPopup(\`
                <div class="popup-header">
                  <span class="popup-title">\${zone.name}</span>
                  <span class="popup-badge" style="background:#F59E0B; color:#000">\${zone.risk_level}</span>
                </div>
                <div class="popup-row"><span>Hazard:</span><span class="popup-val">\${zone.reason}</span></div>
              \`);
            }
          });

          // 2. Draw Green Command HQ (Pure Green Symbol, No Emoji, No Text)
          const hqIcon = L.divIcon({
            className: 'hq-symbol',
            html: '<div class="marker-hq"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          L.marker([13.0827, 80.2907], { icon: hqIcon }).addTo(map).bindPopup(\`
            <div class="popup-header">
              <span class="popup-title">Chennai ICG Base HQ</span>
              <span class="popup-badge badge-station">OPERATIONAL</span>
            </div>
            <div class="popup-row"><span>Base:</span><span class="popup-val">Chennai Coast Guard Station</span></div>
            <div class="popup-row"><span>Sector:</span><span class="popup-val">Bay of Bengal North Zone</span></div>
          \`);

          // 3. Draw Red SOS Alerts (Blinking Red Symbol, No Emoji, No Text)
          sosList.forEach(sos => {
            const boatName = sos.boat ? sos.boat.name : 'Fisherman Boat';
            const fishermanName = sos.fisherman ? sos.fisherman.name : 'Fisherman';

            const sosIcon = L.divIcon({
              className: 'sos-symbol',
              html: '<div class="marker-sos"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });

            const marker = L.marker([sos.latitude, sos.longitude], { icon: sosIcon }).addTo(map);

            const htmlContent = \`
              <div class="popup-header">
                <span class="popup-title">\${sos.emergency_type.toUpperCase()}</span>
                <span class="popup-badge badge-critical">\${sos.priority}</span>
              </div>
              <div class="popup-row"><span>Vessel:</span><span class="popup-val">\${boatName}</span></div>
              <div class="popup-row"><span>Captain:</span><span class="popup-val">\${fishermanName}</span></div>
              <div class="popup-row"><span>Crew on Board:</span><span class="popup-val">\${sos.people_affected} Members</span></div>
              <div class="popup-row"><span>Position:</span><span class="popup-val">\${sos.latitude.toFixed(4)}°N, \${sos.longitude.toFixed(4)}°E</span></div>
              <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#FCA5A5">\${sos.status}</span></div>
            \`;
            marker.bindPopup(htmlContent);
          });

          // 4. Draw Blue Patrol Boats & Intercept Vectors (Pure Blue Symbol, No Emoji, No Text)
          missionList.forEach(m => {
            const targetSOS = sosList.find(s => s.id === m.sos_alert_id);
            if (targetSOS) {
              const patrolLat = targetSOS.latitude - 0.045;
              const patrolLon = targetSOS.longitude - 0.035;

              const patrolIcon = L.divIcon({
                className: 'boat-symbol',
                html: '<div class="marker-boat"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });

              L.marker([patrolLat, patrolLon], { icon: patrolIcon }).addTo(map).bindPopup(\`
                <div class="popup-header">
                  <span class="popup-title">\${m.rescue_vessel}</span>
                  <span class="popup-badge badge-patrol">\${m.status}</span>
                </div>
                <div class="popup-row"><span>Unit:</span><span class="popup-val">\${m.rescue_team}</span></div>
                <div class="popup-row"><span>Target:</span><span class="popup-val">\${targetSOS.boat?.name || 'Distress Vessel'}</span></div>
                <div class="popup-row"><span>ETA:</span><span class="popup-val" style="color:#38BDF8">\${m.eta_minutes} Min</span></div>
              \`);

              L.polyline([[patrolLat, patrolLon], [targetSOS.latitude, targetSOS.longitude]], {
                color: '#38BDF8',
                weight: 2.5,
                dashArray: '6, 6',
                opacity: 0.9
              }).addTo(map);
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: generateLeafletHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    backgroundColor: '#020C17',
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
