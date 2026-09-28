import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FishingNet } from '../types/net';
import { FishermanGPS, getCurrentFishermanGPS } from '../utils/location';
import { NavigationToReleaseMap } from './NavigationToReleaseMap';
import { useLanguage } from '../i18n';

interface FindNetModalProps {
  net: FishingNet | null;
  visible: boolean;
  onClose: () => void;
  onProceedToDrift: (net: FishingNet, fishermanGPS: FishermanGPS) => void;
}

const GPS_ARRIVAL_RADIUS_METERS = 200.0;

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export const FindNetModal: React.FC<FindNetModalProps> = ({
  net,
  visible,
  onClose,
  onProceedToDrift,
}) => {
  const { t, tNetType } = useLanguage();
  const [gps, setGps] = useState<FishermanGPS | null>(null);
  const [loadingGps, setLoadingGps] = useState<boolean>(true);

  useEffect(() => {
    if (visible) {
      loadGps();
    }
  }, [visible]);

  const loadGps = async () => {
    setLoadingGps(true);
    const currGps = await getCurrentFishermanGPS();
    setGps(currGps);
    setLoadingGps(false);
  };

  if (!net) return null;

  const distanceKm = gps
    ? calculateDistanceKm(gps.latitude, gps.longitude, net.release_latitude, net.release_longitude)
    : 0.0;
  const distanceMeters = distanceKm * 1000.0;
  const bearingDeg = gps
    ? calculateBearing(gps.latitude, gps.longitude, net.release_latitude, net.release_longitude)
    : 0.0;

  const hasArrived = distanceMeters <= GPS_ARRIVAL_RADIUS_METERS;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t('findYourNet')}</Text>
            <Text style={styles.headerSubtitle}>
              {net.name} • {tNetType(net.net_type_display || net.net_type)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loadingGps ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTxt}>{t('loading')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Arrival Status Banner */}
            {hasArrived ? (
              <View style={styles.arrivedBanner}>
                <Text style={styles.arrivedIcon}>✓</Text>
                <View style={styles.arrivedTextCol}>
                  <Text style={styles.arrivedTitle}>{t('navigateToRelease')}</Text>
                  <Text style={styles.arrivedSub}>
                    ≤ {GPS_ARRIVAL_RADIUS_METERS}m
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.navBanner}>
                <Text style={styles.navIcon}>🧭</Text>
                <View style={styles.navTextCol}>
                  <Text style={styles.navTitle}>{t('navigateToRelease')}</Text>
                  <Text style={styles.navSub}>
                    {t('distance')}: {distanceKm.toFixed(2)} km ({bearingDeg.toFixed(0)}°)
                  </Text>
                </View>
              </View>
            )}

            {/* Location Comparison Cards */}
            <View style={styles.locationCardsRow}>
              {/* Current Fisherman Location */}
              <View style={[styles.locCard, { borderColor: '#2ECC71' }]}>
                <View style={styles.locBadgeGreen}>
                  <Text style={styles.locBadgeTxt}>{t('yourCurrentGps')}</Text>
                </View>
                <Text style={styles.locCoords}>
                  {gps?.latitude.toFixed(4)}° N, {gps?.longitude.toFixed(4)}° E
                </Text>
                <Text style={styles.locMeta}>{t('accuracy')}: ±{gps?.accuracy.toFixed(0)}m</Text>
              </View>

              {/* Original Net Release Point */}
              <View style={[styles.locCard, { borderColor: '#3498DB' }]}>
                <View style={styles.locBadgeBlue}>
                  <Text style={styles.locBadgeTxt}>{t('netReleasePoint')}</Text>
                </View>
                <Text style={styles.locCoords}>
                  {net.release_latitude.toFixed(4)}° N, {net.release_longitude.toFixed(4)}° E
                </Text>
                <Text style={styles.locMeta}>{t('deployedTime')}: {net.elapsed_time_formatted}</Text>
              </View>
            </View>

            {/* Navigation Map to Release Point */}
            {gps && (
              <NavigationToReleaseMap
                fishermanLat={gps.latitude}
                fishermanLon={gps.longitude}
                releaseLat={net.release_latitude}
                releaseLon={net.release_longitude}
                distanceKm={distanceKm}
                bearingDeg={bearingDeg}
                height={430}
              />
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.predictBtn}
                activeOpacity={0.8}
                onPress={() => onProceedToDrift(net, gps!)}
              >
                <Text style={styles.predictBtnText}>{t('predictNetDriftAnyway')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshLocBtn}
                activeOpacity={0.8}
                onPress={loadGps}
              >
                <Text style={styles.refreshLocTxt}>{t('updateGpsLocation')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0ECE8',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  body: {
    padding: 16,
    paddingBottom: 40,
  },
  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    borderWidth: 1.5,
    borderColor: '#2ECC71',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  arrivedIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E824C',
    marginRight: 10,
  },
  arrivedTextCol: {
    flex: 1,
  },
  arrivedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E824C',
  },
  arrivedSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  navBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    borderWidth: 1.5,
    borderColor: '#3498DB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  navIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  navTextCol: {
    flex: 1,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2980B9',
  },
  navSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  locationCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  locCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
  },
  locBadgeGreen: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  locBadgeBlue: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  locBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.text,
  },
  locCoords: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  locMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 12,
    gap: 8,
  },
  predictBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  predictBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  refreshLocBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  refreshLocTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
});
