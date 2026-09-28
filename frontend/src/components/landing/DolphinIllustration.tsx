import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface DolphinIllustrationProps {
  width?: number;
  height?: number;
}

export const DolphinIllustration: React.FC<DolphinIllustrationProps> = ({
  width = 240,
  height = 150,
}) => {
  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={require('../../../assets/dolphin.png')}
        style={[styles.dolphinImage, { width, height }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dolphinImage: {
    // Hardware accelerated smooth rendering
  },
});
