import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SupportedLanguage } from '../types';
import {
  SOSUIState,
  EmergencyType,
  LocationResult,
  OfflineSOSPacket,
  SOSLifecycleStatus,
} from '../types/sos';
import {
  getCurrentLocation,
  getRealBatteryLevel,
  useBatteryLevel,
  useLocation,
} from '../services/locationService';
import { networkService } from '../services/networkService';
import { websocketService } from '../services/websocketService';
import { offlineP2PTransport } from '../services/transports/offlineP2PTransport';
import { nativeP2PAdapter } from '../services/transports/nativeP2PAdapter';
import { sosService } from '../services/sosService';
import { getNearbyFishermen } from '../services/nearbyFishermenService';
import { getUserSession } from '../storage/storage';
import { getNearestRescueStation } from '../data/mockRescueStations';
import { RescueMissionItem } from '../services/coastalGuardService';
import { playEmergencyBuzzerSound } from '../utils/speech';
import { NearbyFisherman } from '../types/location';

import { SOSButton } from './components/SOSButton';
import { SOSLocationCard } from './components/SOSLocationCard';
import { SOSEmergencyTypeSelector } from './components/SOSEmergencyTypeSelector';
import { SOSConfirmationModal } from './components/SOSConfirmationModal';
import { SOSReceiverModal, IncomingDistressAlert } from './components/SOSReceiverModal';

interface SOSScreenProps {
  currentLanguage?: SupportedLanguage;
}

export const SOSScreen: React.FC<SOSScreenProps> = () => {
  const realBatteryLevel = useBatteryLevel();
  const liveLocation = useLocation();
  const [uiState, setUiState] = useState<SOSUIState>('idle');
  const [sosLifecycleStatus, setSosLifecycleStatus] = useState<SOSLifecycleStatus>('ACTIVE');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('General Emergency');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeSOSPacket, setActiveSOSPacket] = useState<OfflineSOSPacket | null>(null);
  const [activeMission, setActiveMission] = useState<RescueMissionItem | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<IncomingDistressAlert | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [nearbyFishermen, setNearbyFishermen] = useState<NearbyFisherman[]>([]);

  useEffect(() => {
    initSOSScreen();

    // 1. Subscribe to network state
    const unsubNet = networkService.subscribe((online) => {
      setIsOnline(online);
      if (online) {
        websocketService.connect();
      }
    });

    // 2. Connect WebSocket when online
    websocketService.connect();

    // 3. Listen to incoming SOS alerts over WebSocket (Universal Receiver)
    const unsubWSAlert = websocketService.subscribe('SOS_ALERT_CREATED', (payload) => {
      console.log('[SOSScreen] Incoming WS SOS Alert:', payload);
      if (payload && payload.public_sos_id) {
        let distKm: number | null = payload.distance_km ?? null;
        if (
          distKm === null &&
          location?.latitude !== null &&
          location?.latitude !== undefined &&
          location?.longitude !== null &&
          location?.longitude !== undefined &&
          payload.latitude !== null &&
          payload.latitude !== undefined &&
          payload.longitude !== null &&
          payload.longitude !== undefined
        ) {
          distKm = calculateDistanceKm(
            location.latitude,
            location.longitude,
            payload.latitude,
            payload.longitude
          );
        }

        setIncomingAlert({
          public_sos_id: payload.public_sos_id,
          emergency_type: payload.emergency_type,
          priority: payload.priority,
          latitude: payload.latitude,
          longitude: payload.longitude,
          delivery_status: payload.delivery_status || 'ONLINE',
          origin_fisherman_name: payload.fisherman?.name || payload.origin_fisherman_name,
          origin_fisherman_phone: payload.fisherman?.phone || payload.origin_fisherman_phone,
          created_at: payload.created_at,
          distance_km: distKm,
          hop_count: payload.relay_hops || 0,
        });
      }
    });

    // 4. Listen to incoming offline native P2P packets
    const unsubP2P = offlineP2PTransport.onPacketReceived((packet) => {
      console.log('[SOSScreen] [P2P] Incoming Offline P2P Alert:', packet);
      let distKm: number | null = null;
      if (
        location?.latitude !== null &&
        location?.latitude !== undefined &&
        location?.longitude !== null &&
        location?.longitude !== undefined &&
        packet.latitude !== null &&
        packet.latitude !== undefined &&
        packet.longitude !== null &&
        packet.longitude !== undefined
      ) {
        distKm = calculateDistanceKm(
          location.latitude,
          location.longitude,
          packet.latitude,
          packet.longitude
        );
      }

      setIncomingAlert({
        public_sos_id: packet.public_sos_id,
        emergency_type: packet.emergency_type,
        priority: packet.priority,
        latitude: packet.latitude,
        longitude: packet.longitude,
        delivery_status: packet.delivery_status || 'OFFLINE_RELAYED',
        origin_fisherman_name: packet.origin_fisherman_name,
        created_at: packet.created_at,
        distance_km: distKm,
        hop_count: packet.hop_count,
      });
    });

    // 5. Listen to SOS responses (via WebSocket or native P2P)
    const unsubResp = sosService.onResponseReceived((resp) => {
      console.log('[SOSScreen] Incoming SOS Response:', resp);
      setResponses((prev) => [resp, ...prev.filter((r) => r.public_sos_id === resp.public_sos_id && r.responder_fisherman_id === resp.responder_fisherman_id)]);
      if (resp.response === 'YES_HELP') {
        setStatusMessage(`Assistance accepted! Responder heading to your position.`);
      }
    });

    // 6. Listen to SOS status updates
    const unsubStatus = sosService.onStatusChanged((status, extra) => {
      console.log('[SOSScreen] SOS status changed to:', status, extra);
      setSosLifecycleStatus(status);
      if (extra?.rescue_mission) {
        setActiveMission(extra.rescue_mission);
      }
    });

    // 7. Listen to Coastal Guard rescue mission events over WebSocket
    const unsubMissionDispatched = websocketService.subscribe('RESCUE_MISSION_DISPATCHED', (payload) => {
      console.log('[SOSScreen] Rescue mission dispatched:', payload);
      setActiveMission(payload);
      setSosLifecycleStatus('RESCUE_ASSIGNED');
    });

    const unsubMissionUpdated = websocketService.subscribe('RESCUE_MISSION_UPDATED', (payload) => {
      console.log('[SOSScreen] Rescue mission updated:', payload);
      setActiveMission(payload);
      if (payload.status === 'COMPLETED') {
        setSosLifecycleStatus('RESOLVED');
      } else {
        setSosLifecycleStatus('RESCUE_IN_PROGRESS');
      }
    });

    return () => {
      unsubNet();
      unsubWSAlert();
      unsubP2P();
      unsubResp();
      unsubStatus();
      unsubMissionDispatched();
      unsubMissionUpdated();
    };
  }, [location]);

  useEffect(() => {
    if (liveLocation && liveLocation.available && liveLocation.latitude !== null && liveLocation.longitude !== null) {
      setLocation(liveLocation);
    }
  }, [liveLocation]);

  useEffect(() => {
    const fetchNearby = async () => {
      try {
        const list = await getNearbyFishermen(25.0);
        setNearbyFishermen(list);
      } catch (err) {
        // Handled silently
      }
    };
    if (isOnline) {
      fetchNearby();
      const interval = setInterval(fetchNearby, 30000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  // Synchronize Coastal Guard mission status & assignment in real time
  useEffect(() => {
    let syncTimer: any = null;
    if (uiState === 'active' && isOnline) {
      const syncActiveState = async () => {
        try {
          const serverSOS = await sosService.fetchMyActiveSOS();
          if (serverSOS) {
            if (serverSOS.rescue_mission) {
              setActiveMission((prev) => {
                const missionData: RescueMissionItem = {
                  id: serverSOS.rescue_mission.id,
                  sos_alert_id: serverSOS.id,
                  officer_name: serverSOS.rescue_mission.officer_name || 'Cmdr. Coastal Guard HQ',
                  rescue_team: serverSOS.rescue_mission.rescue_team || 'Coast Guard Search & Rescue Unit',
                  rescue_vessel: serverSOS.rescue_mission.rescue_vessel || 'ICGS Fast Interceptor Vessel',
                  status: serverSOS.rescue_mission.status,
                  eta_minutes: serverSOS.rescue_mission.eta_minutes || 15,
                  notes: serverSOS.rescue_mission.notes,
                  created_at: serverSOS.created_at,
                  updated_at: serverSOS.updated_at,
                };
                return missionData;
              });
              if (
                serverSOS.rescue_mission.status === 'DEPARTED' ||
                serverSOS.rescue_mission.status === 'APPROACHING' ||
                serverSOS.rescue_mission.status === 'VICTIM_LOCATED'
              ) {
                setSosLifecycleStatus('RESCUE_IN_PROGRESS');
              } else if (serverSOS.rescue_mission.status === 'COMPLETED') {
                setSosLifecycleStatus('RESOLVED');
              } else {
                setSosLifecycleStatus('RESCUE_ASSIGNED');
              }
            } else if (serverSOS.status) {
              setSosLifecycleStatus(serverSOS.status);
            }
          }
        } catch (e) {
          // ignore transient poll error
        }
      };

      syncActiveState();
      syncTimer = setInterval(syncActiveState, 3000);
    }
    return () => {
      if (syncTimer) clearInterval(syncTimer);
    };
  }, [uiState, isOnline]);

  const initSOSScreen = async () => {
    const online = await networkService.getIsOnline();
    setIsOnline(online);

    const realLoc = await getCurrentLocation();
    setLocation(realLoc);

    const active = await sosService.getActiveSOS();
    if (active) {
      setActiveSOSPacket(active);
      setSosLifecycleStatus(active.sos_status);
      setUiState('active');
    } else {
      // Also check server if online
      if (online) {
        try {
          const serverSOS = await sosService.fetchMyActiveSOS();
          if (serverSOS) {
            setSosLifecycleStatus(serverSOS.status);
            if (serverSOS.rescue_mission) {
              setActiveMission({
                id: serverSOS.rescue_mission.id,
                sos_alert_id: serverSOS.id,
                officer_name: serverSOS.rescue_mission.officer_name || 'Cmdr. Coastal Guard HQ',
                rescue_team: serverSOS.rescue_mission.rescue_team || 'Coast Guard Search & Rescue Unit',
                rescue_vessel: serverSOS.rescue_mission.rescue_vessel || 'ICGS Fast Interceptor Vessel',
                status: serverSOS.rescue_mission.status,
                eta_minutes: serverSOS.rescue_mission.eta_minutes || 15,
                notes: serverSOS.rescue_mission.notes,
                created_at: serverSOS.created_at,
                updated_at: serverSOS.updated_at,
              });
            }
            setUiState('active');
          }
        } catch (e) {}
      }
    }
  };

  const handleSOSTriggered = async () => {
    try {
      playEmergencyBuzzerSound();
      setUiState('getting_location');
      setStatusMessage('Acquiring high-accuracy GPS coordinates...');

      const [loc, freshBatt] = await Promise.all([
        getCurrentLocation(),
        getRealBatteryLevel(),
      ]);
      const currentBatt = freshBatt > 0 ? freshBatt : realBatteryLevel;
      setLocation(loc);

      setUiState('checking_connection');
      setStatusMessage('Checking emergency communication link...');
      const userSession = await getUserSession();

      const packet = await sosService.buildEmergencyPacket(
        loc,
        emergencyType,
        userSession,
        currentBatt,
        1,
        `Emergency distress signal: ${emergencyType}`
      );

      setUiState('sending');
      setStatusMessage(
        isOnline
          ? 'Dispatching distress signal to Coast Guard & nearby vessels...'
          : 'Transmitting offline distress signal via Peer-to-Peer Bluetooth mesh...'
      );

      const dispatchResult = await sosService.sendSOS(packet);

      setActiveSOSPacket(packet);
      setSosLifecycleStatus(dispatchResult.status);
      setUiState('active');
      setStatusMessage(
        dispatchResult.transport_used === 'ONLINE'
          ? 'Distress signal received at Coast Guard HQ & broadcasted to nearby vessels.'
          : 'Distress signal broadcasting over Native P2P Bluetooth mesh & queued for cloud sync.'
      );
    } catch (err: any) {
      console.error('[SOSScreen] SOS dispatch error:', err);
      setUiState('error');
      setStatusMessage(err.message || 'Unable to dispatch SOS. Please tap retry.');
    }
  };

  const handleRetrySending = async () => {
    if (activeSOSPacket) {
      setUiState('sending');
      try {
        const res = await sosService.sendSOS(activeSOSPacket);
        setSosLifecycleStatus(res.status);
        setUiState('active');
        setStatusMessage('SOS sent successfully.');
      } catch (e: any) {
        setUiState('error');
        setStatusMessage(e.message || 'Retry failed.');
      }
    } else {
      setUiState('idle');
    }
  };

  const handleUpdateLocation = async () => {
    if (!activeSOSPacket) return;
    setIsUpdatingLocation(true);
    try {
      const freshLoc = await getCurrentLocation();
      setLocation(freshLoc);

      if (!freshLoc.available) {
        Alert.alert('Unable to update location', 'GPS signal unavailable. Previous coordinates retained.');
      } else {
        await sosService.updateLocation(freshLoc);
        Alert.alert('Location Updated', 'Your fresh GPS coordinates have been transmitted.');
      }
    } catch (e) {
      Alert.alert('Update Failed', 'Could not transmit updated coordinates.');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleConfirmCancel = async () => {
    setShowCancelModal(false);
    setUiState('cancelling');
    setStatusMessage('Broadcasting SOS cancellation event...');

    await sosService.cancelSOS(activeSOSPacket?.public_sos_id, 'User cancelled');

    setActiveSOSPacket(null);
    setActiveMission(null);
    setResponses([]);
    setUiState('cancelled');
    setStatusMessage('SOS alert cancelled successfully.');

    setTimeout(() => {
      setUiState('idle');
      setStatusMessage('');
    }, 2500);
  };

  const handleUniversalResponse = async (decision: 'YES_HELP' | 'RELAY_ONLY' | 'NO') => {
    if (!incomingAlert) return;
    const user = await getUserSession();
    const loc = await getCurrentLocation();

    await sosService.respondToSOS(
      incomingAlert.public_sos_id,
      decision,
      loc,
      user,
      decision === 'YES_HELP'
        ? 'Responding to distress location via P2P.'
        : decision === 'RELAY_ONLY'
        ? 'Relaying SOS alert to subsequent nearby vessels.'
        : 'Cannot assist at this time.'
    );

    setIncomingAlert(null);
    Alert.alert(
      decision === 'YES_HELP'
        ? 'Assistance Confirmed'
        : decision === 'RELAY_ONLY'
        ? 'Relay Active'
        : 'Response Sent',
      decision === 'YES_HELP'
        ? 'Thank you! Your rescue commitment has been transmitted to the distress vessel.'
        : decision === 'RELAY_ONLY'
        ? 'This device is now carrying and forwarding the SOS distress signal to other vessels.'
        : 'Your response has been recorded.'
    );
  };

  const rescueInfo = getNearestRescueStation(
    activeSOSPacket?.latitude ?? location?.latitude ?? null,
    activeSOSPacket?.longitude ?? location?.longitude ?? null
  );

  const isNativeBLE = nativeP2PAdapter.isSupported();

  // Determine stage progression index (0: Sent, 1: Awaiting, 2: Assigned, 3: Navigating, 4: Resolved)
  const getActiveStageIndex = () => {
    if (sosLifecycleStatus === 'RESOLVED') return 4;
    if (
      activeMission?.status === 'DEPARTED' ||
      activeMission?.status === 'APPROACHING' ||
      activeMission?.status === 'VICTIM_LOCATED' ||
      sosLifecycleStatus === 'RESCUE_IN_PROGRESS' ||
      sosLifecycleStatus === 'HELP_ON_THE_WAY'
    ) {
      return 3; // NAVIGATING
    }
    if (activeMission || sosLifecycleStatus === 'RESCUE_ASSIGNED') {
      return 2; // ASSIGNED
    }
    if (uiState === 'active' || sosLifecycleStatus === 'ACTIVE' || sosLifecycleStatus === 'ACKNOWLEDGED') {
      return 1; // AWAITING
    }
    return 0; // SENT
  };

  const currentStageIdx = getActiveStageIndex();

  const handleCallRescue = () => {
    const phone = rescueInfo?.station?.contactPhone || '1554';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Emergency Contact', `Dialing Indian Coast Guard Search & Rescue Helpline: ${phone}`);
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Title Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitleText}>EMERGENCY SOS</Text>
          <View
            style={[
              styles.statusTag,
              uiState === 'active'
                ? activeMission
                  ? styles.tagGreen
                  : styles.tagRed
                : isOnline
                ? styles.tagTeal
                : styles.tagOrange,
            ]}
          >
            <Text style={styles.statusTagText}>
              {uiState === 'active'
                ? activeMission
                  ? 'CG CONNECTED'
                  : `SOS ${sosLifecycleStatus}`
                : isOnline
                ? 'ONLINE / SATELLITE'
                : isNativeBLE
                ? 'OFFLINE / P2P MESH'
                : 'OFFLINE / P2P READY'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitleText}>
          Direct Connected Coastal Guard Search & Rescue Distress Network
        </Text>
      </View>

      {/* 2. Before Activation - SOS Trigger Options */}
      {(uiState === 'idle' ||
        uiState === 'getting_location' ||
        uiState === 'checking_connection' ||
        uiState === 'sending' ||
        uiState === 'cancelled' ||
        uiState === 'error') && (
        <>
          <SOSButton
            onHoldSuccess={handleSOSTriggered}
            disabled={
              uiState === 'getting_location' ||
              uiState === 'checking_connection' ||
              uiState === 'sending'
            }
          />

          {/* Quick One-Tap Send GPS Distress Button */}
          <TouchableOpacity
            style={styles.quickGpsBtn}
            activeOpacity={0.85}
            onPress={handleSOSTriggered}
            disabled={
              uiState === 'getting_location' ||
              uiState === 'checking_connection' ||
              uiState === 'sending'
            }
          >
            <Text style={styles.quickGpsIcon}>📡</Text>
            <View style={styles.quickGpsTextCol}>
              <Text style={styles.quickGpsTitle}>SEND LIVE GPS DISTRESS NOW</Text>
              <Text style={styles.quickGpsSub}>
                Instant 1-Tap broadcast to Coast Guard Command HQ & Nearby Vessels
              </Text>
            </View>
          </TouchableOpacity>

          <SOSEmergencyTypeSelector
            selectedType={emergencyType}
            onSelectType={(type) => setEmergencyType(type)}
          />

          {/* Current GPS Position Preview */}
          <View style={{ marginTop: 12 }}>
            <SOSLocationCard
              latitude={location?.latitude ?? null}
              longitude={location?.longitude ?? null}
              accuracy={location?.accuracy ?? null}
              timestamp={location?.timestamp?.toString()}
              isUnavailable={!location?.available}
            />
          </View>
        </>
      )}

      {/* Status Banner */}
      {statusMessage !== '' && (
        <View
          style={[
            styles.messageBanner,
            uiState === 'error' ? styles.msgError : styles.msgInfo,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              uiState === 'error' ? styles.msgTextError : styles.msgTextInfo,
            ]}
          >
            {statusMessage}
          </Text>

          {uiState === 'error' && (
            <TouchableOpacity onPress={handleRetrySending} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. ACTIVE SOS LIVE TRACKING PIPELINE */}
      {uiState === 'active' && (
        <View style={styles.activeContainer}>
          {/* Main Status Header */}
          <View
            style={[
              styles.activeBanner,
              sosLifecycleStatus === 'RESOLVED'
                ? { backgroundColor: '#10B981', borderColor: '#059669' }
                : activeMission
                ? { backgroundColor: '#0D9488', borderColor: '#0F766E' }
                : { backgroundColor: '#DC2626', borderColor: '#B91C1C' },
            ]}
          >
            <View style={styles.activeBannerTextCol}>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveIndicatorTxt}>LIVE DISTRESS CHANNEL ACTIVE</Text>
              </View>
              <Text style={styles.activeBannerTitle}>
                {sosLifecycleStatus === 'RESOLVED'
                  ? 'RESCUE COMPLETED & RESOLVED'
                  : currentStageIdx === 3
                  ? 'COASTAL GUARD NAVIGATING TO GPS'
                  : currentStageIdx === 2
                  ? 'COASTAL GUARD MISSION ASSIGNED'
                  : currentStageIdx === 1
                  ? 'AWAITING COMMAND HQ DISPATCH'
                  : 'GPS DISTRESS SIGNAL SENT'}
              </Text>
              <Text style={styles.activeBannerSubtitle}>
                PUBLIC ID: {activeSOSPacket?.public_sos_id?.slice(0, 20) || 'CG-DISTRESS-ACTIVE'}...
              </Text>
            </View>
          </View>

          {/* 4-STAGE STEPPER TRACKER PIPELINE */}
          <View style={styles.stepperContainer}>
            <Text style={styles.stepperHeaderTitle}>RESCUE DISPATCH PROGRESS</Text>
            
            <View style={styles.stepperRow}>
              {/* STEP 1: SENT */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    currentStageIdx >= 0 ? styles.stepCircleDone : styles.stepCirclePending,
                  ]}
                >
                  <Text style={styles.stepCircleTxt}>{currentStageIdx > 0 ? '✓' : '1'}</Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStageIdx >= 0 ? styles.stepLabelActive : styles.stepLabelPending,
                  ]}
                >
                  SENT
                </Text>
                <Text style={styles.stepSubTxt}>GPS Transmitted</Text>
              </View>

              <View
                style={[
                  styles.stepConnector,
                  currentStageIdx >= 1 ? styles.stepConnectorActive : styles.stepConnectorPending,
                ]}
              />

              {/* STEP 2: AWAITING */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    currentStageIdx >= 1
                      ? currentStageIdx > 1
                        ? styles.stepCircleDone
                        : styles.stepCircleActive
                      : styles.stepCirclePending,
                  ]}
                >
                  <Text style={styles.stepCircleTxt}>
                    {currentStageIdx > 1 ? '✓' : currentStageIdx === 1 ? '⏳' : '2'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStageIdx >= 1 ? styles.stepLabelActive : styles.stepLabelPending,
                  ]}
                >
                  AWAITING
                </Text>
                <Text style={styles.stepSubTxt}>HQ Review</Text>
              </View>

              <View
                style={[
                  styles.stepConnector,
                  currentStageIdx >= 2 ? styles.stepConnectorActive : styles.stepConnectorPending,
                ]}
              />

              {/* STEP 3: ASSIGNED */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    currentStageIdx >= 2
                      ? currentStageIdx > 2
                        ? styles.stepCircleDone
                        : styles.stepCircleActive
                      : styles.stepCirclePending,
                  ]}
                >
                  <Text style={styles.stepCircleTxt}>
                    {currentStageIdx > 2 ? '✓' : currentStageIdx === 2 ? '🛡️' : '3'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStageIdx >= 2 ? styles.stepLabelActive : styles.stepLabelPending,
                  ]}
                >
                  ASSIGNED
                </Text>
                <Text style={styles.stepSubTxt}>Officer & Vessel</Text>
              </View>

              <View
                style={[
                  styles.stepConnector,
                  currentStageIdx >= 3 ? styles.stepConnectorActive : styles.stepConnectorPending,
                ]}
              />

              {/* STEP 4: NAVIGATING */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    currentStageIdx >= 3 ? styles.stepCircleActiveGreen : styles.stepCirclePending,
                  ]}
                >
                  <Text style={styles.stepCircleTxt}>
                    {currentStageIdx >= 4 ? '✓' : currentStageIdx === 3 ? '🚤' : '4'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStageIdx >= 3 ? styles.stepLabelActiveGreen : styles.stepLabelPending,
                  ]}
                >
                  NAVIGATING
                </Text>
                <Text style={styles.stepSubTxt}>En Route to GPS</Text>
              </View>
            </View>
          </View>

          {/* 4. CONNECTED COASTAL GUARD DETAILS CARD */}
          {activeMission ? (
            <View style={styles.cgConnectedCard}>
              <View style={styles.cgConnectedHeader}>
                <View style={styles.cgLiveBadgeRow}>
                  <View style={styles.cgPulseDot} />
                  <Text style={styles.cgConnectedTitle}>COASTAL GUARD CONNECTED</Text>
                </View>
                <View style={styles.cgStatusPill}>
                  <Text style={styles.cgStatusPillTxt}>
                    {activeMission.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <Text style={styles.cgOfficerPrompt}>
                Indian Coast Guard Command HQ has assigned a tactical Search & Rescue team to your GPS position:
              </Text>

              <View style={styles.cgDetailsGrid}>
                <View style={styles.cgDetailRow}>
                  <Text style={styles.cgDetailLabel}>👮 Commanding Officer:</Text>
                  <Text style={styles.cgDetailValHighlight}>
                    {activeMission.officer_name || 'Cmdr. R. Ramesh (HQ Duty Officer)'}
                  </Text>
                </View>

                <View style={styles.cgDetailRow}>
                  <Text style={styles.cgDetailLabel}>🚢 Rescue Vessel:</Text>
                  <Text style={styles.cgDetailValBadge}>
                    {activeMission.rescue_vessel || 'ICGS Fast Interceptor Craft C-435'}
                  </Text>
                </View>

                <View style={styles.cgDetailRow}>
                  <Text style={styles.cgDetailLabel}>🛡️ Rescue Unit:</Text>
                  <Text style={styles.cgDetailVal}>
                    {activeMission.rescue_team || 'Coast Guard SAR Unit 04'}
                  </Text>
                </View>

                <View style={styles.cgDetailRow}>
                  <Text style={styles.cgDetailLabel}>⏱️ Estimated Arrival (ETA):</Text>
                  <Text style={styles.cgDetailValEta}>
                    {activeMission.eta_minutes || 15} Minutes
                  </Text>
                </View>

                {activeMission.notes ? (
                  <View style={styles.cgNotesBox}>
                    <Text style={styles.cgNotesLabel}>📡 Command Directives / Notes:</Text>
                    <Text style={styles.cgNotesTxt}>{activeMission.notes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Direct Call Rescue Officer Action */}
              <TouchableOpacity
                style={styles.cgCallBtn}
                activeOpacity={0.85}
                onPress={handleCallRescue}
              >
                <Text style={styles.cgCallBtnTxt}>📞 CALL COASTAL GUARD BASE (1554)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cgAwaitingCard}>
              <ActivityIndicator size="small" color="#D97706" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.cgAwaitingTitle}>AWAITING COASTAL GUARD ASSIGNMENT</Text>
                <Text style={styles.cgAwaitingSub}>
                  Your distress beacon & GPS coordinates are live on the Coastal Guard Command radar. An officer will be assigned shortly.
                </Text>
              </View>
            </View>
          )}

          {/* Responder Responses Card */}
          {responses.length > 0 && (
            <View style={styles.responsesCard}>
              <Text style={styles.responsesHeader}>NEARBY RESPONDERS</Text>
              {responses.map((resp, idx) => (
                <View key={idx} style={styles.responseItem}>
                  <Text style={styles.responderName}>
                    {resp.responder_fisherman?.name || resp.responder_name || 'Nearby Vessel'}
                  </Text>
                  <Text
                    style={[
                      styles.responseBadge,
                      resp.response === 'YES_HELP'
                        ? styles.responseBadgeYes
                        : styles.responseBadgeNo,
                    ]}
                  >
                    {resp.response === 'YES_HELP' ? 'ACCEPTED TO HELP' : 'CANNOT ASSIST'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Active Location Info */}
          <SOSLocationCard
            latitude={activeSOSPacket?.latitude ?? location?.latitude ?? null}
            longitude={activeSOSPacket?.longitude ?? location?.longitude ?? null}
            accuracy={activeSOSPacket?.accuracy_meters ?? location?.accuracy ?? null}
            timestamp={activeSOSPacket?.created_at ?? location?.timestamp?.toString()}
            isUnavailable={activeSOSPacket?.latitude === null && location?.latitude === null}
          />

          {/* Active Action Buttons */}
          <View style={styles.activeButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleUpdateLocation}
              disabled={isUpdatingLocation}
              style={styles.updateLocBtn}
            >
              {isUpdatingLocation ? (
                <ActivityIndicator size="small" color="#0D9488" />
              ) : (
                <Text style={styles.updateLocBtnText}>UPDATE GPS LOCATION</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowCancelModal(true)}
              style={styles.cancelSOSBtn}
            >
              <Text style={styles.cancelSOSBtnText}>CANCEL SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Nearest Rescue Station */}
      {rescueInfo && (
        <View style={styles.stationCard}>
          <Text style={styles.stationCardTitle}>PRIMARY RESCUE COORDINATION BASE</Text>
          <View style={styles.stationRow}>
            <Text style={styles.stationName}>{rescueInfo.station.name}</Text>
            <Text style={styles.stationDistance}>
              {rescueInfo.distanceKm !== null
                ? `${rescueInfo.distanceKm.toFixed(1)} km (${(rescueInfo.distanceKm * 0.539957).toFixed(1)} NM)`
                : 'Calculating...'}
            </Text>
          </View>
          <Text style={styles.stationContact}>Emergency Base Line: {rescueInfo.station.contactPhone}</Text>
        </View>
      )}

      {/* 6. Active Nearby Vessels */}
      {nearbyFishermen.length > 0 && (
        <View style={styles.nearbyCard}>
          <Text style={styles.nearbyTitle}>
            ACTIVE NEARBY VESSELS ({nearbyFishermen.length})
          </Text>
          {nearbyFishermen.slice(0, 3).map((f) => (
            <View key={f.fisherman_id} style={styles.nearbyRow}>
              <Text style={styles.nearbyBoatName}>{f.fisherman_name}</Text>
              <Text style={styles.nearbyBoatDist}>{(f.distance_meters / 1000).toFixed(1)} km away</Text>
            </View>
          ))}
        </View>
      )}

      {/* Cancellation Confirmation Modal */}
      <SOSConfirmationModal
        visible={showCancelModal}
        onConfirmCancel={handleConfirmCancel}
        onKeepActive={() => setShowCancelModal(false)}
      />

      {/* Universal SOS Receiver Modal for incoming alerts */}
      <SOSReceiverModal
        visible={incomingAlert !== null}
        alert={incomingAlert}
        onRespond={handleUniversalResponse}
        onDismiss={() => setIncomingAlert(null)}
      />
    </ScrollView>
  );
};

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
  return Math.round(R * c * 10) / 10;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tagRed: {
    backgroundColor: '#DC2626',
  },
  tagOrange: {
    backgroundColor: '#D97706',
  },
  tagTeal: {
    backgroundColor: '#0D9488',
  },
  tagGreen: {
    backgroundColor: '#10B981',
  },
  statusTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  headerSubtitleText: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Quick GPS Button
  quickGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#14B8A6',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  quickGpsIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  quickGpsTextCol: {
    flex: 1,
  },
  quickGpsTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  quickGpsSub: {
    fontSize: 11,
    color: '#CCFBF1',
    marginTop: 2,
    fontWeight: '600',
  },

  messageBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  msgInfo: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  msgError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  msgTextInfo: {
    color: '#0369A1',
  },
  msgTextError: {
    color: '#B91C1C',
  },
  retryBtn: {
    backgroundColor: '#B91C1C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Active SOS Banner
  activeContainer: {
    marginBottom: 16,
  },
  activeBanner: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  activeBannerTextCol: {
    alignItems: 'center',
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  liveIndicatorTxt: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeBannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 4,
  },
  activeBannerSubtitle: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // 4-Stage Stepper Tracker
  stepperContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stepperHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    width: 68,
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleDone: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  stepCircleActive: {
    backgroundColor: '#D97706',
    borderWidth: 2.5,
    borderColor: '#FDE68A',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  stepCircleActiveGreen: {
    backgroundColor: '#0D9488',
    borderWidth: 2.5,
    borderColor: '#5EEAD4',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  stepCirclePending: {
    backgroundColor: '#E2E8F0',
  },
  stepCircleTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#0F766E',
  },
  stepLabelActiveGreen: {
    color: '#0D9488',
  },
  stepLabelPending: {
    color: '#94A3B8',
  },
  stepSubTxt: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  stepConnector: {
    flex: 1,
    height: 3,
    marginBottom: 26,
    borderRadius: 2,
  },
  stepConnectorActive: {
    backgroundColor: '#10B981',
  },
  stepConnectorPending: {
    backgroundColor: '#E2E8F0',
  },

  // Coastal Guard Connected Card
  cgConnectedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#10B981',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cgConnectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
    paddingBottom: 8,
  },
  cgLiveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cgPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginRight: 8,
  },
  cgConnectedTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
  },
  cgStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cgStatusPillTxt: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#15803D',
  },
  cgOfficerPrompt: {
    fontSize: 11.5,
    color: '#1E3A36',
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 16,
  },
  cgDetailsGrid: {
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  cgDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cgDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  cgDetailVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  cgDetailValHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
  },
  cgDetailValBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cgDetailValEta: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
  },
  cgNotesBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cgNotesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  cgNotesTxt: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 16,
    fontWeight: '600',
  },
  cgCallBtn: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#166534',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  cgCallBtnTxt: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Coastal Guard Awaiting Card
  cgAwaitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 14,
  },
  cgAwaitingTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#B45309',
    marginBottom: 2,
  },
  cgAwaitingSub: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },

  // Responses Card
  responsesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  responsesHeader: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  responseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  responderName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  responseBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  responseBadgeYes: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  responseBadgeNo: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },

  // Action Buttons
  activeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  updateLocBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateLocBtnText: {
    color: '#0D9488',
    fontSize: 12.5,
    fontWeight: '900',
  },
  cancelSOSBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSOSBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },

  // Base Station Card
  stationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  stationCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  stationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stationName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  stationDistance: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0D9488',
  },
  stationContact: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },

  // Nearby Vessels Card
  nearbyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  nearbyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  nearbyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  nearbyBoatName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  nearbyBoatDist: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
});
