import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Colors } from '../theme/colors';
import { FishingNet, CreateNetPayload } from '../types/net';
import { FishermanGPS } from '../utils/location';
import { NetCard } from '../components/NetCard';
import { AddNetModal } from '../components/AddNetModal';
import { FindNetModal } from '../components/FindNetModal';
import { NetDriftDetailModal } from '../components/NetDriftDetailModal';
import { fetchActiveNets, createFishingNet, getCachedNets } from '../services/netService';
import { useLanguage } from '../i18n';

export const MyNetsScreen: React.FC = () => {
  const { t } = useLanguage();
  const initialCached = getCachedNets();
  const [nets, setNets] = useState<FishingNet[]>(initialCached);
  const [loading, setLoading] = useState<boolean>(initialCached.length === 0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  
  const [selectedNet, setSelectedNet] = useState<FishingNet | null>(null);
  const [fishermanGps, setFishermanGps] = useState<FishermanGPS | null>(null);
  const [findNetModalVisible, setFindNetModalVisible] = useState<boolean>(false);
  const [driftModalVisible, setDriftModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadNets();
  }, []);

  const loadNets = async () => {
    try {
      const data = await fetchActiveNets();
      if (data && data.length > 0) {
        setNets(data);
      }
    } catch (err: any) {
      console.log('Error fetching active nets:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNets();
  };

  const handleCreateNet = async (payload: CreateNetPayload) => {
    const created = await createFishingNet(payload);
    setNets((prev) => [created, ...prev]);
    Alert.alert(
      t('netDeployedSuccess'),
      `"${created.name}" ${t('netDeployedMsg')}`
    );
  };

  const handleOpenFindNet = (net: FishingNet) => {
    setSelectedNet(net);
    setFindNetModalVisible(true);
  };

  const handleProceedToDrift = (net: FishingNet, gps: FishermanGPS) => {
    setFindNetModalVisible(false);
    setFishermanGps(gps);
    setSelectedNet(net);
    setDriftModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.titleWrapper}>
          <Text style={styles.pageTitle} numberOfLines={1}>{t('myNetsTitle')}</Text>
          <Text style={styles.pageSubtitle} numberOfLines={1}>{t('myNetsSubtitle')}</Text>
        </View>

        <TouchableOpacity
          style={styles.addNetBtn}
          activeOpacity={0.8}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.addNetBtnText} numberOfLines={1}>{t('addNewNet')}</Text>
        </TouchableOpacity>
      </View>

      {/* Nets List */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingLabel}>{t('loadingNets')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        >
          {nets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚓</Text>
              <Text style={styles.emptyTitle}>{t('noNetsTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('noNetsDesc')}</Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={styles.emptyActionBtnText}>{t('addNewNet')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            nets.map((item) => (
              <NetCard
                key={item.id}
                net={item}
                onViewDrift={handleOpenFindNet}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Add Net Modal */}
      <AddNetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSubmit={handleCreateNet}
      />

      {/* Step 1: Find Your Net & Navigation to Release Point */}
      <FindNetModal
        net={selectedNet}
        visible={findNetModalVisible}
        onClose={() => setFindNetModalVisible(false)}
        onProceedToDrift={handleProceedToDrift}
      />

      {/* Step 2: Net Drift Trajectory & Search Area Details */}
      <NetDriftDetailModal
        net={selectedNet}
        fishermanGPS={fishermanGps}
        visible={driftModalVisible}
        onClose={() => setDriftModalVisible(false)}
        onNetUpdated={loadNets}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 14,
    gap: 8,
  },
  titleWrapper: {
    flex: 1,
    marginRight: 6,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addNetBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addNetBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  loadingArea: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  scrollList: {
    paddingBottom: 120,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
