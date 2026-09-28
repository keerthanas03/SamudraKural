import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const realSeaBgAsset = require('../assets/real_sea_bg.jpg');

interface OceanSceneProps {
  height?: number;
}

export const OceanScene: React.FC<OceanSceneProps> = ({ height: sceneHeight = height }) => {
  return (
    <View style={[styles.container, { width, height: sceneHeight }]}>
      {/* Real Aerial Ocean Background Image */}
      <Image
        source={realSeaBgAsset}
        style={[styles.bgImage, { width, height: sceneHeight }]}
        resizeMode="cover"
      />
      {/* Soft Top & Bottom Marine Vignette for Text Contrast */}
      <View style={styles.vignetteOverlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 45, 60, 0.25)',
  },
});
