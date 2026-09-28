import React from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface FishProps {
  size?: number;
}

// Fish 1 (Top): Top-Notch Striped Bass - Pearlescent silver body, 3D volume shading, luminous teal side fin, Facing RIGHT
export const FishOne: React.FC<FishProps> = ({ size = 275 }) => {
  const height = size * 0.42;
  return (
    <Svg width={size} height={height} viewBox="0 0 275 115" fill="none">
      <Defs>
        <LinearGradient id="f1BodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="40%" stopColor="#F2FAF7" />
          <Stop offset="75%" stopColor="#D5EBE3" />
          <Stop offset="100%" stopColor="#AFD6CB" />
        </LinearGradient>
        <LinearGradient id="f1SpineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#0B2328" />
          <Stop offset="50%" stopColor="#143B3E" />
          <Stop offset="100%" stopColor="#0A1D20" />
        </LinearGradient>
        <LinearGradient id="f1FinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#00F5D4" />
          <Stop offset="50%" stopColor="#1E9385" />
          <Stop offset="100%" stopColor="#094A42" />
        </LinearGradient>
        <LinearGradient id="f1BellyFinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#12353B" />
          <Stop offset="100%" stopColor="#051216" />
        </LinearGradient>
      </Defs>
      <G>
        {/* Tail fin on left with delicate ray lines */}
        <Path d="M14 57 L42 24 C33 57, 33 57, 42 90 Z" fill="url(#f1BodyGrad)" stroke="#0B2328" strokeWidth="3.5" />
        <Path d="M20 42 L39 57 L20 72 M26 49 L40 57 L26 65" stroke="#0B2328" strokeWidth="2" fill="none" opacity="0.7" />
        
        {/* Dark pelvic & anal fins below */}
        <Path d="M92 78 L108 104 L124 78 Z" fill="url(#f1BellyFinGrad)" stroke="#0B2328" strokeWidth="2" />
        <Path d="M144 78 L160 102 L176 78 Z" fill="url(#f1BellyFinGrad)" stroke="#0B2328" strokeWidth="2" />

        {/* Spiny top dorsal fin with fine structural rays */}
        <Path d="M102 36 C122 8, 165 10, 180 36 Z" fill="url(#f1BodyGrad)" stroke="#0B2328" strokeWidth="3" />
        <Path d="M116 32 L128 14 M134 29 L146 11 M152 30 L162 13 M168 32 L174 20" stroke="#0B2328" strokeWidth="2.5" strokeLinecap="round" />

        {/* Main body outline with pearlescent contour fill */}
        <Path d="M42 57 C78 22, 180 22, 240 57 C180 92, 78 92, 42 57 Z" fill="url(#f1BodyGrad)" stroke="#0B2328" strokeWidth="4" />
        
        {/* Metallic dark back crest */}
        <Path d="M48 54 C80 26, 175 26, 232 54 C175 35, 80 35, 48 54 Z" fill="url(#f1SpineGrad)" opacity="0.3" />

        {/* 6 Dark vertical body stripes */}
        <Path d="M70 38 V76 M94 31 V83 M120 27 V87 M146 27 V87 M172 31 V83 M196 38 V76" stroke="#0B2328" strokeWidth="8" strokeLinecap="round" />
        
        {/* Lateral line curve */}
        <Path d="M46 57 C100 50, 180 50, 238 57" stroke="#1E9385" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.6" fill="none" />

        {/* Luminous teal pectoral side fin */}
        <Path d="M148 57 C164 57, 176 67, 170 76 C153 76, 144 65, 148 57 Z" fill="url(#f1FinGrad)" stroke="#0B2328" strokeWidth="2" />

        {/* Operculum & Head section */}
        <Path d="M202 40 C222 49, 233 55, 240 57 C233 59, 222 65, 202 74 Z" fill="url(#f1BodyGrad)" />
        <Path d="M195 39 C187 57, 187 57, 195 75" stroke="#0B2328" strokeWidth="3" fill="none" />

        {/* Top-Notch 3D Eye on right */}
        <Circle cx="222" cy="53" r="6.5" fill="#0B2328" />
        <Circle cx="222" cy="53" r="4.5" fill="#00F5D4" opacity="0.7" />
        <Circle cx="222" cy="53" r="3.2" fill="#000000" />
        <Circle cx="224" cy="51" r="1.8" fill="#FFFFFF" />
        <Circle cx="220" cy="55" r="0.9" fill="#FFFFFF" opacity="0.8" />
      </G>
    </Svg>
  );
};

// Fish 2 (Second): Top-Notch Velvet Angelfish - Midnight emerald gradient body, iridescent white stripes, Facing LEFT
export const FishTwo: React.FC<FishProps> = ({ size = 285 }) => {
  const height = size * 0.48;
  return (
    <Svg width={size} height={height} viewBox="0 0 285 138" fill="none">
      <Defs>
        <LinearGradient id="f2BodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1E4D3C" />
          <Stop offset="40%" stopColor="#123629" />
          <Stop offset="80%" stopColor="#091F17" />
          <Stop offset="100%" stopColor="#040D0A" />
        </LinearGradient>
        <LinearGradient id="f2StripeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#E2FAF2" />
          <Stop offset="100%" stopColor="#B3EADB" />
        </LinearGradient>
        <LinearGradient id="f2CheekGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#DDF3EC" />
        </LinearGradient>
      </Defs>
      <G>
        {/* Tail fin on right with delicate arc trim */}
        <Path d="M275 69 C250 36, 250 36, 240 69 C250 102, 250 102, 275 69 Z" fill="url(#f2BodyGrad)" stroke="#0B2328" strokeWidth="3" />
        <Path d="M250 51 C263 69, 263 69, 250 87" stroke="url(#f2StripeGrad)" strokeWidth="3.5" fill="none" />

        {/* Velvet rounded dorsal & anal fins */}
        <Path d="M92 29 C155 10, 205 20, 225 39 Z" fill="url(#f2BodyGrad)" stroke="#0B2328" strokeWidth="3" />
        <Path d="M92 109 C155 128, 205 118, 225 99 Z" fill="url(#f2BodyGrad)" stroke="#0B2328" strokeWidth="3" />

        {/* Main velvet oval body */}
        <Path d="M240 69 C185 15, 72 15, 36 69 C72 123, 185 123, 240 69 Z" fill="url(#f2BodyGrad)" stroke="#0B2328" strokeWidth="4" />
        
        {/* Iridescent white concentric curved stripes */}
        <Path d="M62 69 C82 33, 185 33, 220 69 C185 105, 82 105, 62 69 Z" fill="none" stroke="url(#f2StripeGrad)" strokeWidth="6.5" />
        <Path d="M88 69 C105 43, 170 43, 200 69 C170 95, 105 95, 88 69 Z" fill="none" stroke="url(#f2StripeGrad)" strokeWidth="5.8" />
        <Path d="M114 69 C126 51, 155 51, 180 69 C155 87, 126 87, 114 69 Z" fill="none" stroke="url(#f2StripeGrad)" strokeWidth="5" />
        
        {/* White face cheek patch on left */}
        <Path d="M36 69 C49 49, 64 45, 78 69 C64 93, 49 89, 36 69 Z" fill="url(#f2CheekGrad)" />
        
        {/* Dark pectoral fin on side */}
        <Path d="M100 69 C118 69, 125 80, 118 88 C102 88, 96 77, 100 69 Z" fill="url(#f2BodyGrad)" stroke="#FFFFFF" strokeWidth="2" />

        {/* Top-Notch 3D Eye on left */}
        <Circle cx="54" cy="66" r="6" fill="#0B2328" />
        <Circle cx="54" cy="66" r="4.2" fill="#00F5D4" opacity="0.6" />
        <Circle cx="54" cy="66" r="3" fill="#000000" />
        <Circle cx="52" cy="64" r="1.7" fill="#FFFFFF" />
      </G>
    </Svg>
  );
};

// Fish 3 (Third): Top-Notch Atlantic Sailfish - Luminous turquoise sail fin, metallic silver body, sword beak, Facing RIGHT
export const FishThree: React.FC<FishProps> = ({ size = 285 }) => {
  const height = size * 0.53;
  return (
    <Svg width={size} height={height} viewBox="0 0 285 142" fill="none">
      <Defs>
        <LinearGradient id="sailFinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#00F5D4" />
          <Stop offset="35%" stopColor="#1E9385" />
          <Stop offset="80%" stopColor="#0D5950" />
          <Stop offset="100%" stopColor="#052E2A" />
        </LinearGradient>
        <LinearGradient id="f3BodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="45%" stopColor="#EDF8F5" />
          <Stop offset="85%" stopColor="#C4E7DE" />
          <Stop offset="100%" stopColor="#9FD4C7" />
        </LinearGradient>
        <LinearGradient id="f3BeakGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#0B2328" />
          <Stop offset="50%" stopColor="#1B4E59" />
          <Stop offset="100%" stopColor="#07181C" />
        </LinearGradient>
      </Defs>
      <G>
        {/* Large sail-like dorsal fin on top with turquoise gradient & crisp white structural rays */}
        <Path d="M96 56 C126 4, 178 8, 168 62 Z" fill="url(#sailFinGrad)" stroke="#0B2328" strokeWidth="4" />
        <Path d="M112 43 L148 58 M124 25 L157 56 M138 14 L163 53 M150 20 L166 56" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        
        {/* Pelvic fin rays trailing below */}
        <Path d="M142 90 L158 128 L168 90 Z" fill="#0B2328" />

        {/* Tail fin on left with teal accents */}
        <Path d="M10 71 L41 36 C31 71, 31 71, 41 106 Z" fill="url(#f3BodyGrad)" stroke="#0B2328" strokeWidth="3" />
        <Path d="M18 53 L37 71 M18 89 L37 71" stroke="#1E9385" strokeWidth="3.5" strokeLinecap="round" />
        
        {/* Main silver body */}
        <Path d="M39 71 C71 43, 168 43, 233 71 C168 99, 71 99, 39 71 Z" fill="url(#f3BodyGrad)" stroke="#0B2328" strokeWidth="4" />
        
        {/* Dark metallic back spine line */}
        <Path d="M43 69 C82 44, 168 44, 228 69" stroke="#0B2328" strokeWidth="6.5" fill="none" />
        
        {/* Teal side fin */}
        <Path d="M144 69 C160 69, 172 79, 162 85 C148 85, 142 76, 144 69 Z" fill="url(#sailFinGrad)" stroke="#0B2328" strokeWidth="2" />

        {/* Sharp sword beak / nose on right */}
        <Path d="M233 71 L278 71 M228 68 L278 71 L228 74 Z" fill="url(#f3BeakGrad)" stroke="#0B2328" strokeWidth="2.5" />

        {/* Top-Notch 3D Eye on right */}
        <Circle cx="212" cy="66" r="6" fill="#0B2328" />
        <Circle cx="212" cy="66" r="4.2" fill="#00F5D4" opacity="0.7" />
        <Circle cx="212" cy="66" r="3" fill="#000000" />
        <Circle cx="214" cy="64" r="1.7" fill="#FFFFFF" />
        <Circle cx="210" cy="68" r="0.9" fill="#FFFFFF" opacity="0.8" />
      </G>
    </Svg>
  );
};

// Fish 4 (Bottom): Top-Notch King Mackerel - Silvery body with dark tiger stripe bars, Facing RIGHT
export const FishFour: React.FC<FishProps> = ({ size = 275 }) => {
  const height = size * 0.41;
  return (
    <Svg width={size} height={height} viewBox="0 0 275 102" fill="none">
      <Defs>
        <LinearGradient id="f4BodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#F0FAF6" />
          <Stop offset="80%" stopColor="#D2EBE3" />
          <Stop offset="100%" stopColor="#AFD6CB" />
        </LinearGradient>
      </Defs>
      <G>
        {/* Tail fin on left with ray lines */}
        <Path d="M15 51 L41 23 C33 51, 33 51, 41 79 Z" fill="url(#f4BodyGrad)" stroke="#0B2328" strokeWidth="3" />
        <Path d="M23 39 L37 51 L23 63" stroke="#0B2328" strokeWidth="2.5" fill="none" opacity="0.7" />

        {/* Small dorsal fin on top */}
        <Path d="M112 33 C127 15, 147 20, 152 33 Z" fill="url(#f4BodyGrad)" stroke="#0B2328" strokeWidth="3" />

        {/* Main silvery body */}
        <Path d="M41 51 C81 23, 178 23, 238 51 C178 79, 81 79, 41 51 Z" fill="url(#f4BodyGrad)" stroke="#0B2328" strokeWidth="4" />

        {/* 7 Dark vertical stripe arches */}
        <Path d="M76 36 C71 51, 71 51, 76 66" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M94 31 C87 51, 87 51, 94 71" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M112 28 C104 51, 104 51, 112 74" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M130 27 C122 51, 122 51, 130 75" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M148 28 C140 51, 140 51, 148 74" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M166 31 C158 51, 158 51, 166 71" stroke="#0B2328" strokeWidth="5" fill="none" />
        <Path d="M184 36 C178 51, 178 51, 184 66" stroke="#0B2328" strokeWidth="5" fill="none" />

        {/* Dark pectoral side fin */}
        <Path d="M150 53 C164 53, 172 61, 166 67 C154 67, 148 59, 150 53 Z" fill="#0F2B36" stroke="#0B2328" strokeWidth="2" />

        {/* Head section & Top-Notch 3D Eye on right */}
        <Path d="M200 37 C220 44, 230 49, 238 51 C230 53, 220 58, 200 65 Z" fill="url(#f4BodyGrad)" />
        <Circle cx="220" cy="48" r="6" fill="#0B2328" />
        <Circle cx="220" cy="48" r="4" fill="#00F5D4" opacity="0.5" />
        <Circle cx="220" cy="48" r="3" fill="#000000" />
        <Circle cx="222" cy="46" r="1.6" fill="#FFFFFF" />
      </G>
    </Svg>
  );
};

interface FishContainerProps {
  animFish1: Animated.ValueXY;
  animFish2?: Animated.ValueXY;
  animFish3?: Animated.ValueXY;
  animFish4?: Animated.ValueXY;
  floatAnim1?: Animated.Value;
  floatAnim2?: Animated.Value;
  floatAnim3?: Animated.Value;
  floatAnim4?: Animated.Value;
  wiggleAnim1?: Animated.Value;
  wiggleAnim2?: Animated.Value;
  wiggleAnim3?: Animated.Value;
  wiggleAnim4?: Animated.Value;
}

export const FishGroup: React.FC<FishContainerProps> = ({
  animFish1,
  animFish2,
  animFish3,
  animFish4,
  floatAnim1,
  floatAnim2,
  floatAnim3,
  floatAnim4,
  wiggleAnim1,
  wiggleAnim2,
  wiggleAnim3,
  wiggleAnim4,
}) => {
  const { height: screenHeight } = Dimensions.get('window');

  // Dynamically calculated responsive fish size fitting any screen height/width cleanly
  const baseSize = Math.min(width * 0.54, Math.max(130, (screenHeight * 0.42) / 4 / 0.46));
  const fish1Size = Math.round(baseSize * 0.95);
  const fish2Size = Math.round(baseSize * 1.0);
  const fish3Size = Math.round(baseSize * 1.0);
  const fish4Size = Math.round(baseSize * 0.95);

  // Idle floating Y displacement
  const floatY1 = floatAnim1 ? floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) : 0;
  const floatY2 = floatAnim2 ? floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) : 0;
  const floatY3 = floatAnim3 ? floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) : 0;
  const floatY4 = floatAnim4 ? floatAnim4.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) : 0;

  // Tail-wiggling swimming oscillation rotation
  const wiggle1 = wiggleAnim1 ? wiggleAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-3deg', '3deg', '-3deg'] }) : '0deg';
  const wiggle2 = wiggleAnim2 ? wiggleAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['3deg', '-3deg', '3deg'] }) : '0deg';
  const wiggle3 = wiggleAnim3 ? wiggleAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-3.5deg', '3.5deg', '-3.5deg'] }) : '0deg';
  const wiggle4 = wiggleAnim4 ? wiggleAnim4.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['2.8deg', '-2.8deg', '2.8deg'] }) : '0deg';

  // Heading alignment rotation when swimming away
  const rot1 = animFish1.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: ['0deg', '-5deg'],
  });
  const scale1 = animFish1.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: [1, 0.86],
  });

  const rot2 = animFish2 ? animFish2.x.interpolate({
    inputRange: [-width * 1.5, 0],
    outputRange: ['5deg', '0deg'],
  }) : '0deg';
  const scale2 = animFish2 ? animFish2.x.interpolate({
    inputRange: [-width * 1.5, 0],
    outputRange: [0.86, 1],
  }) : 1;

  const rot3 = animFish3 ? animFish3.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: ['0deg', '-11deg'],
  }) : '0deg';
  const scale3 = animFish3 ? animFish3.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: [1, 0.82],
  }) : 1;

  const rot4 = animFish4 ? animFish4.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: ['0deg', '8deg'],
  }) : '0deg';
  const scale4 = animFish4 ? animFish4.x.interpolate({
    inputRange: [0, width * 1.5],
    outputRange: [1, 0.84],
  }) : 1;

  const fish2Transform = animFish2 ? animFish2.getTranslateTransform() : [];
  const fish3Transform = animFish3 ? animFish3.getTranslateTransform() : [];
  const fish4Transform = animFish4 ? animFish4.getTranslateTransform() : [];

  return (
    <View style={styles.groupContainer}>
      {/* Fish 1 - Facing RIGHT */}
      <Animated.View
        style={[
          styles.fishWrapper,
          {
            transform: [
              ...animFish1.getTranslateTransform(),
              { translateY: floatY1 },
              { rotate: rot1 },
              { rotate: wiggle1 },
              { scale: scale1 },
            ],
          },
        ]}
      >
        <FishOne size={fish1Size} />
      </Animated.View>

      {/* Fish 2 - Facing LEFT */}
      <Animated.View
        style={[
          styles.fishWrapper,
          {
            transform: [
              ...fish2Transform,
              { translateY: floatY2 },
              { rotate: rot2 },
              { rotate: wiggle2 },
              { scale: scale2 },
            ],
          },
        ]}
      >
        <FishTwo size={fish2Size} />
      </Animated.View>

      {/* Fish 3 - Facing RIGHT */}
      <Animated.View
        style={[
          styles.fishWrapper,
          {
            transform: [
              ...fish3Transform,
              { translateY: floatY3 },
              { rotate: rot3 },
              { rotate: wiggle3 },
              { scale: scale3 },
            ],
          },
        ]}
      >
        <FishThree size={fish3Size} />
      </Animated.View>

      {/* Fish 4 - Facing RIGHT */}
      <Animated.View
        style={[
          styles.fishWrapper,
          {
            transform: [
              ...fish4Transform,
              { translateY: floatY4 },
              { rotate: rot4 },
              { rotate: wiggle4 },
              { scale: scale4 },
            ],
          },
        ]}
      >
        <FishFour size={fish4Size} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingVertical: 4,
  },
  fishWrapper: {
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
