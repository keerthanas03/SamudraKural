import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { EnvironmentalState } from '../types/net';
import { useLanguage } from '../i18n';

interface EnvironmentCardProps {
  environment?: EnvironmentalState | null;
}

export const EnvironmentCard: React.FC<EnvironmentCardProps> = ({ environment }) => {
  const { t, tDirection, tSeaState } = useLanguage();

  if (!environment) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeaderTitle}>🌊 {t('seaWeatherConditions')}</Text>
      <Text style={styles.cardSubtitle}>{t('basedOnForecast')}</Text>

      <View style={styles.metricsGrid}>
        {/* Ocean Current */}
        <View style={styles.metricItem}>
          <Text style={styles.metricIcon}>🌊</Text>
          <Text style={styles.metricTitle}>{t('oceanCurrent')}</Text>
          <Text style={styles.metricValue}>
            {tDirection(environment.current_direction_cardinal || 'Northeast')}
          </Text>
          <Text style={styles.metricSubvalue}>
            {environment.current_speed_mps.toFixed(2)} m/s (~{(environment.current_speed_mps * 1.94).toFixed(1)} kts)
          </Text>
        </View>

        {/* Wind */}
        <View style={styles.metricItem}>
          <Text style={styles.metricIcon}>💨</Text>
          <Text style={styles.metricTitle}>{t('wind')}</Text>
          <Text style={styles.metricValue}>
            {tDirection(environment.wind_direction_cardinal || 'Northeast')}
          </Text>
          <Text style={styles.metricSubvalue}>
            {environment.wind_speed_kmh.toFixed(0)} km/h
          </Text>
        </View>

        {/* Sea Condition */}
        <View style={styles.metricItem}>
          <Text style={styles.metricIcon}>⛵</Text>
          <Text style={styles.metricTitle}>{t('seaState')}</Text>
          <Text style={styles.metricValue}>
            {tSeaState(environment.sea_state || 'Moderate')}
          </Text>
          <Text style={styles.metricSubvalue}>
            {t('wave')}: {environment.wave_height.toFixed(1)} m
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primaryDark,
    textAlign: 'center',
    marginBottom: 2,
  },
  metricSubvalue: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
