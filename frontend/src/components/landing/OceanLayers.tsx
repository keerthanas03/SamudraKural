import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Ellipse,
  G,
} from 'react-native-svg';

interface OceanLayersProps {
  width: number;
  height: number;
  splashOpacity?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
  splashScale?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
  rippleScale?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
  rippleOpacity?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
  emergeRippleScale?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
  emergeRippleOpacity?: Animated.AnimatedValue | Animated.AnimatedInterpolation<number>;
}

export const OceanLayers: React.FC<OceanLayersProps> = ({
  width,
  height,
  splashOpacity,
  splashScale,
  rippleScale,
  rippleOpacity,
  emergeRippleScale,
  emergeRippleOpacity,
}) => {
  const oceanTopY = height * 0.40;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* 1. Morning Sunrise Sky Gradient */}
          <LinearGradient id="sunriseSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E6F5F6" />
            <Stop offset="45%" stopColor="#F1F9F8" />
            <Stop offset="75%" stopColor="#FFF2E6" />
            <Stop offset="100%" stopColor="#FDE3CE" />
          </LinearGradient>

          {/* 2. Soft Glowing Sun */}
          <RadialGradient id="sunGlowGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFF8E7" stopOpacity="1" />
            <Stop offset="35%" stopColor="#FFE5B4" stopOpacity="0.85" />
            <Stop offset="70%" stopColor="#FFD1A4" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FDE3CE" stopOpacity="0" />
          </RadialGradient>

          {/* 3. Horizon Sun Water Reflection */}
          <LinearGradient id="sunWaterReflect" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFF5DC" stopOpacity="0.65" />
            <Stop offset="50%" stopColor="#FFDEAA" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#007982" stopOpacity="0" />
          </LinearGradient>

          {/* 4. Distant Sea Mist / Horizon Layer */}
          <LinearGradient id="distantSeaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#3AA3AB" />
            <Stop offset="100%" stopColor="#007E88" />
          </LinearGradient>

          {/* 5. Midground Rolling Ocean Waves */}
          <LinearGradient id="midOceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#00838D" />
            <Stop offset="50%" stopColor="#006670" />
            <Stop offset="100%" stopColor="#004D55" />
          </LinearGradient>

          {/* 6. Deep Foreground Ocean Mass */}
          <LinearGradient id="deepForegroundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#006770" />
            <Stop offset="30%" stopColor="#005058" />
            <Stop offset="100%" stopColor="#00353B" />
          </LinearGradient>

          {/* 7. Wave Crest White Foam */}
          <LinearGradient id="waveFoamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#C9FAF5" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#007E88" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* ─── SKY & SUNRISE ─── */}
        <Rect x="0" y="0" width={width} height={oceanTopY + 20} fill="url(#sunriseSky)" />

        {/* Soft Morning Clouds */}
        <G opacity={0.55}>
          <Path
            d={`M ${width * 0.08} ${oceanTopY - 110} 
               q 25 -20 50 0 
               q 35 -15 65 0 
               q 20 18 -10 24 
               q -60 10 -105 -24 Z`}
            fill="#FFFFFF"
          />
          <Path
            d={`M ${width * 0.65} ${oceanTopY - 130} 
               q 30 -18 60 0 
               q 40 -12 70 0 
               q 15 16 -15 22 
               q -65 8 -115 -22 Z`}
            fill="#FFFFFF"
          />
        </G>

        {/* Radiant Sunrise Disc */}
        <Circle
          cx={width * 0.52}
          cy={oceanTopY - 10}
          r={54}
          fill="url(#sunGlowGrad)"
        />

        {/* ─── DISTANT FISHING BOATS ON HORIZON ─── */}
        {/* Boat 1: Distant Trawler on the Left */}
        <G transform={`translate(${width * 0.16}, ${oceanTopY - 12}) scale(0.65)`} opacity={0.75}>
          <Path d="M 0 10 L 4 15 L 34 15 L 38 10 Z" fill="#0D444A" />
          <Rect x="14" y="3" width="12" height="7" rx="1" fill="#0D444A" />
          <Path d="M 20 3 L 20 -9 M 10 10 L 20 -6 L 30 10" stroke="#0D444A" strokeWidth="1.2" />
        </G>

        {/* Boat 2: Small Distant Fishing Boat on the Right */}
        <G transform={`translate(${width * 0.78}, ${oceanTopY - 9}) scale(0.5)`} opacity={0.65}>
          <Path d="M 0 8 L 3 13 L 28 13 L 32 8 Z" fill="#0D444A" />
          <Rect x="12" y="3" width="9" height="5" rx="1" fill="#0D444A" />
          <Path d="M 16 3 L 16 -6 M 8 8 L 16 -4 L 24 8" stroke="#0D444A" strokeWidth="1" />
        </G>

        {/* ─── LAYER 1: DISTANT HORIZON OCEAN SWELL ─── */}
        <Path
          d={`M 0 ${oceanTopY} 
             Q ${width * 0.25} ${oceanTopY - 4}, ${width * 0.5} ${oceanTopY} 
             Q ${width * 0.75} ${oceanTopY + 5}, ${width} ${oceanTopY} 
             L ${width} ${height} 
             L 0 ${height} Z`}
          fill="url(#distantSeaGrad)"
        />

        {/* Golden Sun Reflection along Center Water Line */}
        <Path
          d={`M ${width * 0.42} ${oceanTopY} 
             L ${width * 0.62} ${oceanTopY} 
             L ${width * 0.68} ${oceanTopY + 65} 
             L ${width * 0.36} ${oceanTopY + 65} Z`}
          fill="url(#sunWaterReflect)"
        />

        {/* ─── LAYER 2: MIDGROUND ROLLING WAVES ─── */}
        <Path
          d={`M 0 ${oceanTopY + 14} 
             C ${width * 0.18} ${oceanTopY + 2}, ${width * 0.38} ${oceanTopY + 22}, ${width * 0.62} ${oceanTopY + 10} 
             C ${width * 0.82} ${oceanTopY + 2}, ${width * 0.94} ${oceanTopY + 16}, ${width} ${oceanTopY + 14} 
             L ${width} ${height} 
             L 0 ${height} Z`}
          fill="url(#midOceanGrad)"
          opacity={0.92}
        />

        {/* ─── LAYER 3: FOREGROUND DEEP OCEAN & WAVE CRESTS ─── */}
        <Path
          d={`M 0 ${oceanTopY + 30} 
             C ${width * 0.22} ${oceanTopY + 16}, ${width * 0.48} ${oceanTopY + 40}, ${width * 0.72} ${oceanTopY + 24} 
             C ${width * 0.88} ${oceanTopY + 16}, ${width * 0.96} ${oceanTopY + 32}, ${width} ${oceanTopY + 30} 
             L ${width} ${height} 
             L 0 ${height} Z`}
          fill="url(#deepForegroundGrad)"
        />

        {/* Wave Crest Foam Ribbons */}
        <Path
          d={`M 0 ${oceanTopY + 30} 
             C ${width * 0.22} ${oceanTopY + 16}, ${width * 0.48} ${oceanTopY + 40}, ${width * 0.72} ${oceanTopY + 24} 
             C ${width * 0.88} ${oceanTopY + 16}, ${width * 0.96} ${oceanTopY + 32}, ${width} ${oceanTopY + 30} 
             L ${width} ${oceanTopY + 38} 
             C ${width * 0.88} ${oceanTopY + 24}, ${width * 0.72} ${oceanTopY + 34}, ${width * 0.48} ${oceanTopY + 48} 
             C ${width * 0.22} ${oceanTopY + 26}, 0 ${oceanTopY + 38}, 0 ${oceanTopY + 38} Z`}
          fill="url(#waveFoamGrad)"
        />

        {/* Shimmering Surface Highlights */}
        <Ellipse
          cx={width * 0.32}
          cy={oceanTopY + 62}
          rx={45}
          ry={3}
          fill="#86ECE3"
          opacity={0.3}
        />
        <Ellipse
          cx={width * 0.72}
          cy={oceanTopY + 76}
          rx={55}
          ry={3.5}
          fill="#86ECE3"
          opacity={0.25}
        />
        <Ellipse
          cx={width * 0.50}
          cy={oceanTopY + 105}
          rx={70}
          ry={4}
          fill="#86ECE3"
          opacity={0.2}
        />
      </Svg>

      {/* ─── EMERGENCE RIPPLE (EXTREME LEFT LAUNCH POINT) ─── */}
      {emergeRippleScale && emergeRippleOpacity && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rippleWrapper,
            {
              left: width * 0.05 - 30,
              top: height * 0.48 - 4,
              opacity: emergeRippleOpacity,
              transform: [{ scale: emergeRippleScale }],
            },
          ]}
        >
          <Svg width={90} height={32} viewBox="0 0 90 32">
            <Ellipse
              cx={45}
              cy={16}
              rx={42}
              ry={12}
              stroke="#B2F5EE"
              strokeWidth={2}
              fill="none"
              opacity={0.85}
            />
          </Svg>
        </Animated.View>
      )}

      {/* ─── MAIN SPLASH RIPPLE (EXTREME RIGHT WATER ENTRY) ─── */}
      {rippleScale && rippleOpacity && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rippleWrapper,
            {
              left: width * 0.90 - 55,
              top: height * 0.48 - 6,
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        >
          <Svg width={110} height={40} viewBox="0 0 110 40">
            <Ellipse
              cx={55}
              cy={20}
              rx={50}
              ry={16}
              stroke="#A8EAE4"
              strokeWidth={2.8}
              fill="none"
              opacity={0.9}
            />
            <Ellipse
              cx={55}
              cy={20}
              rx={32}
              ry={10}
              stroke="#D2FBF7"
              strokeWidth={2}
              fill="none"
              opacity={0.8}
            />
          </Svg>
        </Animated.View>
      )}

      {/* ─── DYNAMIC SPLASH CROWN & SPRAY PARTICLES (EXTREME RIGHT ENTRY) ─── */}
      {splashOpacity && splashScale && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.splashWrapper,
            {
              left: width * 0.90 - 50,
              top: height * 0.48 - 50,
              opacity: splashOpacity,
              transform: [{ scale: splashScale }],
            },
          ]}
        >
          <Svg width={100} height={75} viewBox="0 0 100 75">
            {/* Splash Crown Water Jets */}
            <Path
              d="M 36 65 C 38 48, 30 32, 22 22 C 30 34, 38 48, 42 64 Z"
              fill="#D4FBF7"
            />
            <Path
              d="M 48 64 C 50 40, 48 18, 44 6 C 50 20, 54 40, 52 64 Z"
              fill="#FFFFFF"
            />
            <Path
              d="M 54 64 C 58 48, 66 32, 76 22 C 68 34, 62 48, 58 65 Z"
              fill="#D4FBF7"
            />

            {/* Spray Droplets & Particles */}
            <Circle cx={20} cy={16} r={3} fill="#C2F8F3" />
            <Circle cx={42} cy={4} r={3.2} fill="#FFFFFF" />
            <Circle cx={54} cy={6} r={2.8} fill="#FFFFFF" />
            <Circle cx={76} cy={14} r={3} fill="#C2F8F3" />
            <Circle cx={86} cy={28} r={2.5} fill="#9EEFE7" />
            <Circle cx={12} cy={30} r={2.2} fill="#9EEFE7" />
            <Circle cx={32} cy={10} r={1.8} fill="#FFFFFF" />
            <Circle cx={66} cy={8} r={1.8} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  rippleWrapper: {
    position: 'absolute',
    width: 110,
    height: 40,
  },
  splashWrapper: {
    position: 'absolute',
    width: 100,
    height: 75,
  },
});
