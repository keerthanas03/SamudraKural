import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

interface DataSourceCardProps {
  dataSources?: string[];
  dataAgeMinutes?: number;
  modelVersion?: string;
}

export const DataSourceCard: React.FC<DataSourceCardProps> = ({
  dataSources = ['INCOIS_OSF', 'COPERNICUS_MARINE'],
  dataAgeMinutes = 12,
  modelVersion = 'v1.0.0-surface-leeway',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.titleWithIcon}>
          <Text style={styles.icon}>🛰️</Text>
          <Text style={styles.title}>Data used for this prediction</Text>
        </View>
        <Text style={styles.toggleArrow}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.contentBody}>
          <View style={styles.sourceItem}>
            <Text style={styles.checkMark}>✓</Text>
            <View style={styles.sourceTextWrapper}>
              <Text style={styles.sourceName}>INCOIS</Text>
              <Text style={styles.sourceDesc}>
                Indian National Ocean State Forecast (wind, waves & coastal currents)
              </Text>
            </View>
          </View>

          <View style={styles.sourceItem}>
            <Text style={styles.checkMark}>✓</Text>
            <View style={styles.sourceTextWrapper}>
              <Text style={styles.sourceName}>Copernicus Marine Service</Text>
              <Text style={styles.sourceDesc}>
                Physics hydrodynamic currents, wave fields & Stokes drift
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              🕒 Forecast updated {dataAgeMinutes > 0 ? `${dataAgeMinutes}m ago` : 'just now'}
            </Text>
            <Text style={styles.metaText}>Model: {modelVersion}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8FCFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  toggleArrow: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  contentBody: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0ECEC',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkMark: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '900',
    marginRight: 8,
    marginTop: 1,
  },
  sourceTextWrapper: {
    flex: 1,
  },
  sourceName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  sourceDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF6F6',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
