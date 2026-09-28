import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface WavyHeaderProps {
  height?: number;
}

export const WavyTopBorder: React.FC<WavyHeaderProps> = ({ height = 45 }) => {
  return (
    <View style={{ width, height, backgroundColor: '#235E4B' }}>
      <Svg width={width} height={height} viewBox="0 0 375 45" preserveAspectRatio="none">
        <Path
          d="M0,0 L375,0 L375,10 C325,38 285,5 245,22 C205,38 165,5 125,22 C85,38 45,5 0,22 Z"
          fill="#FAF8F5"
        />
      </Svg>
    </View>
  );
};

export const OceanBackground: React.FC = () => {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  // 6 ambient floating bubbles
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;
  const bubble4 = useRef(new Animated.Value(0)).current;
  const bubble5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Primary ocean wave current
    Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Secondary ocean wave current (reverse direction drift)
    Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Rising ambient ocean bubbles
    const animateBubble = (anim: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateBubble(bubble1, 6500, 0);
    animateBubble(bubble2, 8000, 1200);
    animateBubble(bubble3, 7200, 2500);
    animateBubble(bubble4, 9000, 800);
    animateBubble(bubble5, 7600, 3200);
  }, []);

  const waveTranslateX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const waveTranslateX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 20],
  });

  const createBubbleStyle = (anim: Animated.Value, leftPercent: `${number}%`, size: number) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [400, -80],
    });
    const translateX = anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 15, -10],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 0.6, 0.6, 0],
    });
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1.2],
    });

    return {
      position: 'absolute' as const,
      left: leftPercent,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.45)',
      opacity,
      transform: [{ translateY }, { translateX }, { scale }],
    };
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Primary Ocean Current Lines */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: width + 160,
            transform: [{ translateX: waveTranslateX1 }],
          },
        ]}
      >
        <Svg width={width + 160} height="100%" viewBox={`0 0 ${width + 160} 600`} preserveAspectRatio="none">
          <Path d="M-40 50 Q100 10 240 50 T520 50 T800 50" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
          <Path d="M-40 160 Q100 120 240 160 T520 160 T800 160" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
          <Path d="M-40 270 Q100 230 240 270 T520 270 T800 270" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
          <Path d="M-40 380 Q100 340 240 380 T520 380 T800 380" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
          <Path d="M-40 490 Q100 450 240 490 T520 490 T800 490" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
        </Svg>
      </Animated.View>

      {/* Secondary Counter-drift Wave Lines */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: width + 160,
            transform: [{ translateX: waveTranslateX2 }],
          },
        ]}
      >
        <Svg width={width + 160} height="100%" viewBox={`0 0 ${width + 160} 600`} preserveAspectRatio="none">
          <Path d="M-40 105 Q100 145 240 105 T520 105 T800 105" stroke="rgba(255,255,255,0.04)" strokeWidth="4" fill="none" />
          <Path d="M-40 215 Q100 255 240 215 T520 215 T800 215" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
          <Path d="M-40 325 Q100 365 240 325 T520 325 T800 325" stroke="rgba(255,255,255,0.04)" strokeWidth="4" fill="none" />
          <Path d="M-40 435 Q100 475 240 435 T520 435 T800 435" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
        </Svg>
      </Animated.View>

      {/* Animated Rising Ambient Bubbles */}
      <Animated.View style={createBubbleStyle(bubble1, '12%', 14)} />
      <Animated.View style={createBubbleStyle(bubble2, '35%', 18)} />
      <Animated.View style={createBubbleStyle(bubble3, '65%', 12)} />
      <Animated.View style={createBubbleStyle(bubble4, '82%', 16)} />
      <Animated.View style={createBubbleStyle(bubble5, '50%', 10)} />
    </View>
  );
};

interface HeaderWaveBottomProps {
  color?: string;
  bgColor?: string;
  height?: number;
}

export const HeaderWaveBottom: React.FC<HeaderWaveBottomProps> = ({
  color = Colors.primary,
  bgColor = Colors.background,
  height = 42,
}) => {
  // Horizontal drift animations (incommensurate cycles for natural randomness)
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // Vertical ocean swell / breathing animations
  const swellAnim1 = useRef(new Animated.Value(0)).current;
  const swellAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Surface random wave current (4400ms loop)
    Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 4400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. Mid-tide counter current (6800ms loop)
    Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 6800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Deep undercurrent swell (9400ms loop)
    Animated.loop(
      Animated.timing(waveAnim3, {
        toValue: 1,
        duration: 9400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 4. Organic vertical wave swell / surge modulation (3100ms sinusoidal breathing)
    Animated.loop(
      Animated.sequence([
        Animated.timing(swellAnim1, {
          toValue: 1,
          duration: 3100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swellAnim1, {
          toValue: 0,
          duration: 3100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 5. Secondary vertical swell modulation (4600ms sinusoidal breathing)
    Animated.loop(
      Animated.sequence([
        Animated.timing(swellAnim2, {
          toValue: 1,
          duration: 4600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swellAnim2, {
          toValue: 0,
          duration: 4600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Horizontal translation interpolations (based on respective period widths)
  const waveTranslateX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -960],
  });

  const waveTranslateX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-840, 0],
  });

  const waveTranslateX3 = waveAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -720],
  });

  // Vertical swell scaling and translation for organic ocean morphing
  const swellScaleY1 = swellAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.15],
  });

  const swellTranslateY1 = swellAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-2, 3],
  });

  const swellScaleY2 = swellAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1.12, 0.85],
  });

  return (
    <View style={{ width: '100%', height, backgroundColor: bgColor, overflow: 'hidden' }}>
      {/* LAYER 1: Deep Undercurrent Swell (Dark Sea Depth) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 2160,
          height,
          transform: [
            { translateX: waveTranslateX3 },
            { scaleY: swellScaleY2 },
          ],
        }}
      >
        <Svg width={2160} height={height} viewBox="0 0 2160 100" preserveAspectRatio="none">
          <Path
            fill={Colors.primaryDark || '#004344'}
            fillOpacity={0.35}
            d="M 0 0 L 2160 0 L 2160 55 C 2040 22, 1920 88, 1800 50 C 1660 15, 1540 82, 1440 55 C 1320 22, 1200 88, 1080 50 C 940 15, 820 82, 720 55 C 600 22, 480 88, 360 50 C 220 15, 100 82, 0 55 Z"
          />
        </Svg>
      </Animated.View>

      {/* LAYER 2: Mid-Tide Aqua Foam Wave (Translucent Vibrant Aqua) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 2520,
          height,
          transform: [
            { translateX: waveTranslateX2 },
            { scaleY: swellScaleY1 },
          ],
        }}
      >
        <Svg width={2520} height={height} viewBox="0 0 2520 100" preserveAspectRatio="none">
          <Path
            fill={Colors.accent || '#00A896'}
            fillOpacity={0.42}
            d="M 0 0 L 2520 0 L 2520 48 C 2440 14, 2360 82, 2260 44 C 2180 8, 2080 92, 1980 52 C 1880 20, 1780 78, 1680 48 C 1600 14, 1520 82, 1420 44 C 1340 8, 1240 92, 1140 52 C 1040 20, 940 78, 840 48 C 760 14, 680 82, 580 44 C 500 8, 400 92, 300 52 C 200 20, 100 78, 0 48 Z"
          />
        </Svg>
      </Animated.View>

      {/* LAYER 3: Main Dynamic Asymmetrical Surface Wave (Solid Teal) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 2880,
          height,
          transform: [
            { translateX: waveTranslateX1 },
            { translateY: swellTranslateY1 },
            { scaleY: swellScaleY1 },
          ],
        }}
      >
        <Svg width={2880} height={height} viewBox="0 0 2880 100" preserveAspectRatio="none">
          <Path
            fill={color}
            d="M 0 0 L 2880 0 L 2880 46 C 2810 12, 2730 84, 2640 42 C 2550 8, 2460 92, 2360 48 C 2270 18, 2190 88, 2100 38 C 2010 10, 1950 78, 1920 46 C 1850 12, 1770 84, 1680 42 C 1590 8, 1500 92, 1400 48 C 1310 18, 1230 88, 1140 38 C 1050 10, 990 78, 960 46 C 890 12, 810 84, 720 42 C 630 8, 540 92, 440 48 C 350 18, 270 88, 180 38 C 90 10, 30 78, 0 46 Z"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};
