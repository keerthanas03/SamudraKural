import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  coastalGuardService,
  MarineConditionsData,
  RiskZoneItem,
} from '../../services/coastalGuardService';

interface CGMarineConditionsScreenProps {
  hideTopHeader?: boolean;
}

const INITIAL_MARINE_CONDITIONS: MarineConditionsData = {
  overall_risk_level: 'CAUTION',
  risk_color: '#f56d0bff',
  risk_title: 'Moderate Swell & Coastal Wind Advisory',
  risk_reason: 'Increased wave heights (1.8m) and gusty winds observed near North Chennai & Pulicat coastal waters.',
  last_updated: 'Just now',
  data_source: 'Coastal Marine Radar',
  is_live_data: true,
  wind: { speed_kmh: 24.5, direction: 'NE', gust_kmh: 31.0 },
  waves: { height_m: 1.8, period_seconds: 7.2, direction: 'ENE' },
  ocean: { surface_temp_c: 28.5, current_speed_knots: 1.4, current_direction: 'NE' },
  weather: { condition: 'Partly Cloudy', visibility_km: 8.5, rainfall_mm: 0, warning: 'Exercise caution near shallow reefs' },
};

const INITIAL_RISK_ZONES: RiskZoneItem[] = [
  {
    zone_id: 'Z-01',
    name: 'Pulicat Shoals & Shoal Waters',
    risk_level: 'HIGH',
    reason: 'Shallow sandbars and sudden 2.2m swell breaks',
    coordinates: [{ lat: 13.4000, lon: 80.3200 }],
    valid_until: 'Today, 23:59',
  },
  {
    zone_id: 'Z-02',
    name: 'Kasimedu Deep Anchorage',
    risk_level: 'CAUTION',
    reason: 'Heavy commercial vessel traffic & choppy currents',
    coordinates: [{ lat: 13.1300, lon: 80.3100 }],
    valid_until: 'Tomorrow, 12:00',
  },
];

export const CGMarineConditionsScreen: React.FC<CGMarineConditionsScreenProps> = ({
  hideTopHeader = false,
}) => {
  const [conditions, setConditions] = useState<MarineConditionsData>(INITIAL_MARINE_CONDITIONS);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>(INITIAL_RISK_ZONES);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    fetchMarineData();
    const timer = setInterval(() => {
      fetchMarineData();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const fetchMarineData = async () => {
    try {
      const [cond, zones] = await Promise.all([
        coastalGuardService.getMarineConditions(),
        coastalGuardService.getRiskZones(),
      ]);
      setConditions(cond);
      setRiskZones(zones);
    } catch (e) {
      console.log('[CGMarineConditions] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarineData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#041421" />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>⚓ Marine Conditions & Risk</Text>
            </View>
            <View style={styles.radarBadge}>
              <View style={styles.radarDot} />
              <Text style={styles.radarTxt}>RADAR LIVE</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0284C7" />
        }
      >
        {/* Overall Risk Level Card */}
        <View style={[styles.riskBannerCard, { borderColor: conditions.risk_color || '#0284C7' }]}>
          <View style={styles.riskHeaderRow}>
            <View style={[styles.riskLevelBadge, { backgroundColor: conditions.risk_color }]}>
              <Text style={styles.riskLevelTxt}>⚠️ {conditions.overall_risk_level} RISK</Text>
            </View>
            <Text style={styles.timeTxt}>⏱️ {conditions.last_updated}</Text>
          </View>

          <Text style={styles.riskTitle}>{conditions.risk_title}</Text>
          <Text style={styles.riskReason}>{conditions.risk_reason}</Text>
        </View>

        {/* Telemetry Matrix Grid Header */}
        <View style={styles.secTitleRow}>
          <Text style={styles.sectionHeading}>📊 Live Environmental Matrix</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillTxt}>UPDATED REAL-TIME</Text>
          </View>
        </View>

        {/* Wind Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌬️ WIND & GUST</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wind Speed</Text>
              <Text style={styles.telemValHighlight}>{conditions.wind.speed_kmh} <Text style={styles.unitTxt}>km/h</Text></Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Direction</Text>
              <Text style={styles.telemVal}>{conditions.wind.direction}</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Peak Gusts</Text>
              <Text style={styles.telemValAmber}>{conditions.wind.gust_kmh} <Text style={styles.unitTxt}>km/h</Text></Text>
            </View>
          </View>
        </View>

        {/* Wave Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌊 SEA SWELL & WAVE MATRIX</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wave Height</Text>
              <Text style={[styles.telemValHighlight, { color: conditions.waves.height_m >= 1.5 ? '#EA580C' : '#0284C7' }]}>
                {conditions.waves.height_m} <Text style={styles.unitTxt}>meters</Text>
              </Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wave Period</Text>
              <Text style={styles.telemVal}>{conditions.waves.period_seconds} <Text style={styles.unitTxt}>sec</Text></Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Swell Direction</Text>
              <Text style={styles.telemVal}>{conditions.waves.direction}</Text>
            </View>
          </View>
        </View>

        {/* Ocean Hydrodynamics Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🛥️ OCEAN HYDRODYNAMICS & CURRENTS</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Surface Temp</Text>
              <Text style={styles.telemValCyan}>{conditions.ocean.surface_temp_c}°C</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Current Speed</Text>
              <Text style={styles.telemVal}>{conditions.ocean.current_speed_knots} <Text style={styles.unitTxt}>knots</Text></Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Drift Course</Text>
              <Text style={styles.telemVal}>{conditions.ocean.current_direction}</Text>
            </View>
          </View>
        </View>

        {/* Weather & Squall Warnings */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌦️ COASTAL WEATHER & VISIBILITY</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Condition</Text>
              <Text style={styles.telemVal}>{conditions.weather.condition}</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Visibility</Text>
              <Text style={styles.telemValGreen}>{conditions.weather.visibility_km} <Text style={styles.unitTxt}>km</Text></Text>
            </View>
          </View>
          {conditions.weather.warning ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningTxt}>⚠️ ADVISORY: {conditions.weather.warning}</Text>
            </View>
          ) : null}
        </View>

        {/* High Risk Marine Zones */}
        <View style={styles.secTitleRow}>
          <Text style={styles.sectionHeading}>⚠️ Restricted & High-Risk Marine Zones</Text>
        </View>

        {riskZones.map((zone) => (
          <View key={zone.zone_id} style={styles.zoneCard}>
            <View style={styles.zoneHeader}>
              <Text style={styles.zoneName}>📍 {zone.name}</Text>
              <View style={[styles.zoneBadge, { backgroundColor: zone.risk_level === 'HIGH' ? '#FEE2E2' : '#FEF3C7', borderColor: zone.risk_level === 'HIGH' ? '#EF4444' : '#F59E0B' }]}>
                <Text style={[styles.zoneBadgeTxt, { color: zone.risk_level === 'HIGH' ? '#DC2626' : '#D97706' }]}>
                  {zone.risk_level} RISK
                </Text>
              </View>
            </View>
            <Text style={styles.zoneReason}>Reason: {zone.reason}</Text>
            <Text style={styles.zoneValid}>⏱️ Valid until: {zone.valid_until}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cgBackground,
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.cgPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  header: {
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#BAE6FD',
    marginTop: 3,
    fontWeight: '600',
  },
  radarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  radarDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  radarTxt: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  riskBannerCard: {
    backgroundColor: Colors.cgSecondary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: Colors.cgBorder,
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  riskLevelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  riskLevelTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  riskTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.cgPrimary,
    marginBottom: 6,
  },
  riskReason: {
    fontSize: 13,
    color: Colors.cgText,
    lineHeight: 19,
    fontWeight: '500',
  },
  timeTxt: {
    fontSize: 11,
    color: Colors.cgAccent,
    fontWeight: '700',
  },
  secTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.cgPrimary,
    letterSpacing: 0.3,
  },
  statusPill: {
    backgroundColor: '#EBF4FC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  statusPillTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.cgAccent,
  },
  telemetryCard: {
    backgroundColor: Colors.cgSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardCatTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.cgPrimary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  telemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  telemItem: {
    flex: 1,
    backgroundColor: Colors.cgSurface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  telemLabel: {
    fontSize: 11,
    color: Colors.cgTextSecondary,
    fontWeight: '600',
  },
  telemVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.cgPrimary,
    marginTop: 4,
  },
  telemValHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0284C7',
    marginTop: 4,
  },
  telemValCyan: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0284C7',
    marginTop: 4,
  },
  telemValAmber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D97706',
    marginTop: 4,
  },
  telemValGreen: {
    fontSize: 14,
    fontWeight: '900',
    color: '#059669',
    marginTop: 4,
  },
  unitTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    lineHeight: 16,
  },
  zoneCard: {
    backgroundColor: '#E0F2FE', // Pale Blue Zone Card
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F3A5D',
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  zoneBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  zoneReason: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  zoneValid: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 6,
    fontWeight: '700',
  },
});
