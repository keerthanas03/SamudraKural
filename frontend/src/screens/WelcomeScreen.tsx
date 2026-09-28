import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { t, supportedLanguages } from '../i18n';
import { SupportedLanguage } from '../types';
import { DolphinIllustration } from '../components/landing/DolphinIllustration';
import { OceanLayers } from '../components/landing/OceanLayers';

interface WelcomeScreenProps {
  currentLanguage: SupportedLanguage;
  onGetStarted: () => void;
  onChangeLanguage?: () => void;
  onOpenCoastalGuard?: () => void;
}

// ─── VECTOR ICONS ───

// Globe & Dropdown Icon for Language Selector
const GlobeLanguagePill: React.FC<{
  label: string;
  onPress?: () => void;
  isDark?: boolean;
}> = ({ label, onPress, isDark = false }) => (
  <TouchableOpacity
    style={[styles.langPill, isDark && styles.langPillDark]}
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel="Select Application Language"
  >
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={isDark ? '#004A4C' : '#005F60'} strokeWidth="2" />
      <Path
        d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        stroke={isDark ? '#004A4C' : '#005F60'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    <Text style={[styles.langPillText, isDark && styles.langPillTextDark]}>
      {label}
    </Text>
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 3 }}>
      <Path
        d="M6 9l6 6 6-6"
        stroke={isDark ? '#004A4C' : '#005F60'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </TouchableOpacity>
);

// Shield Icon for Modal
const ShieldIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#005F60',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 12l2 2 4-4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Navigation Icon for Modal
const NavigationIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#005F60',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Path
      d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Arrow Right Icon for Modal
const ArrowRightIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#FFFFFF',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12h14M12 5l7 7-7 7"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentLanguage,
  onGetStarted,
  onChangeLanguage,
  onOpenCoastalGuard,
}) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [animationStage, setAnimationStage] = useState<number>(1);
  const [isInteractive, setIsInteractive] = useState<boolean>(false);

  // Active language label
  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);
  const langLabel = currentLangObj ? currentLangObj.nativeName : 'English';

  // ─── ANIMATED VALUES ───
  // Header Branding
  const animHeaderOpacity = useRef(new Animated.Value(0)).current;
  const animHeaderTranslate = useRef(new Animated.Value(12)).current;

  // Dolphin Motion Progress (0.0 to 1.0)
  const animDolphinProgress = useRef(new Animated.Value(0)).current;
  const animDolphinOpacity = useRef(new Animated.Value(0)).current;

  // Water Splash and Ripples
  const animSplashScale = useRef(new Animated.Value(0)).current;
  const animSplashOpacity = useRef(new Animated.Value(0)).current;
  const animRippleScale = useRef(new Animated.Value(0.1)).current;
  const animRippleOpacity = useRef(new Animated.Value(0)).current;
  const animEmergeRippleScale = useRef(new Animated.Value(0.2)).current;
  const animEmergeRippleOpacity = useRef(new Animated.Value(0)).current;

  // Bottom Tagline / Progress Indicator
  const animTaglineOpacity = useRef(new Animated.Value(1)).current;

  // Final Action Content (Feature Cards, GET STARTED Button, Bottom Language Link)
  const animFinalContentOpacity = useRef(new Animated.Value(0)).current;
  const animFinalContentTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    runSeamlessContinuousAnimation();
  }, []);

  const runSeamlessContinuousAnimation = () => {
    // 1. Initial State: Fade in top branding header (0 - 450ms)
    Animated.parallel([
      Animated.timing(animHeaderOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(animHeaderTranslate, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Left Emergence Ripple (fires right at 250ms)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(animEmergeRippleOpacity, {
          toValue: 0.9,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(animEmergeRippleScale, {
          toValue: 1.4,
          duration: 450,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(animEmergeRippleOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 250);

    // 3. Continuous, Silky-Smooth Leap (EXTREME LEFT → HIGH PEAK → EXTREME RIGHT)
    // Starts at 300ms, runs for 1900ms without interruption or mid-flight pauses
    setTimeout(() => {
      animDolphinOpacity.setValue(1);

      // Single continuous native-driven progress from 0 to 1
      Animated.timing(animDolphinProgress, {
        toValue: 1,
        duration: 1900,
        easing: Easing.linear, // Strictly linear horizontal progression = 0 hesitations / no stuck in between
        useNativeDriver: true,
      }).start(() => {
        // Dolphin plunges below water
        Animated.timing(animDolphinOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();

        // Right water entry splash
        triggerWaterSplash();
      });

      // 4. Seamless cross-fade to final feature cards & GET STARTED button (starts at 1450ms into jump)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(animTaglineOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(animFinalContentOpacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animFinalContentTranslate, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsInteractive(true);
          setAnimationStage(6);
        });
      }, 1450);
    }, 300);
  };

  const triggerWaterSplash = () => {
    Animated.parallel([
      // 1. Splash crown jets upward & fades
      Animated.sequence([
        Animated.parallel([
          Animated.timing(animSplashScale, {
            toValue: 1.2,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animSplashOpacity, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(animSplashScale, {
            toValue: 1.4,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animSplashOpacity, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // 2. Circular water ripple expands
      Animated.sequence([
        Animated.timing(animRippleOpacity, {
          toValue: 0.95,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(animRippleScale, {
            toValue: 1.8,
            duration: 550,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animRippleOpacity, {
            toValue: 0,
            duration: 550,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  };

  // Skip animation for instant interaction if tapped early
  const handleDirectGetStarted = () => {
    animHeaderOpacity.setValue(1);
    animHeaderTranslate.setValue(0);
    animDolphinOpacity.setValue(0);
    animTaglineOpacity.setValue(0);
    animFinalContentOpacity.setValue(1);
    animFinalContentTranslate.setValue(0);
    setIsInteractive(true);
    setAnimationStage(6);
    setShowRoleModal(true);
  };

  // ─── RESPONSIVE DOLPHIN TRAJECTORY (EXTREME LEFT → SMOOTH CURVED ARC → EXTREME RIGHT) ───
  const dolphinWidth = Math.min(SCREEN_WIDTH * 0.58, 230);
  const dolphinHeight = dolphinWidth * 0.628;

  // Positioned lower down into the water body
  const waterLevelY = SCREEN_HEIGHT * 0.48;

  // Horizontal trajectory: Constant, smooth travel from Extreme Left to Extreme Right
  const dolphinTranslateX = animDolphinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      -dolphinWidth * 0.75,               // Extreme Left launch (beak emerges at left edge)
      SCREEN_WIDTH - dolphinWidth * 0.30, // Extreme Right plunge (dives into water at right edge)
    ],
  });

  // Vertical leap arc: Graceful, curved parabolic jump shape
  const dolphinTranslateY = animDolphinProgress.interpolate({
    inputRange: [0, 0.12, 0.25, 0.38, 0.50, 0.62, 0.75, 0.88, 1.0],
    outputRange: [
      waterLevelY + 45,  // Emergence in left water
      waterLevelY - 10,  // Curving out of water
      waterLevelY - 65,  // Ascending smooth curve
      waterLevelY - 110, // Rising toward apex
      waterLevelY - 130, // Crest of the curved arc
      waterLevelY - 110, // Curving down from apex
      waterLevelY - 65,  // Descending smooth curve
      waterLevelY - 10,  // Approaching right surface
      waterLevelY + 45,  // Plunging into right water
    ],
  });

  // Posture smoothly following the curved arc tangent
  const dolphinRotation = animDolphinProgress.interpolate({
    inputRange: [0, 0.12, 0.25, 0.38, 0.50, 0.62, 0.75, 0.88, 1.0],
    outputRange: [
      '-38deg', // Pointing upward on left emergence
      '-28deg', // Curving up
      '-18deg', // Ascending curve
      '-8deg',  // Approaching horizontal
      '0deg',   // Completely level at crest
      '+10deg', // Beginning downward curve
      '+22deg', // Descending curve
      '+34deg', // Curving toward plunge
      '+44deg', // Diving head-first into right water
    ],
  });

  // Natural scale breathing along the curve
  const dolphinScale = animDolphinProgress.interpolate({
    inputRange: [0, 0.50, 1.0],
    outputRange: [0.90, 1.05, 0.90],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E6F5F6" />

      {/* Layer 1: Multi-Layered Calm Sunrise Ocean with Fishing Boats */}
      <OceanLayers
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        splashOpacity={animSplashOpacity}
        splashScale={animSplashScale}
        rippleScale={animRippleScale}
        rippleOpacity={animRippleOpacity}
        emergeRippleScale={animEmergeRippleScale}
        emergeRippleOpacity={animEmergeRippleOpacity}
      />

      {/* Layer 2: Hero Animated Jumping Dolphin (Full-screen extreme left → peak → extreme right flight) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.dolphinWrapper,
            {
              width: dolphinWidth,
              height: dolphinHeight,
              opacity: animDolphinOpacity,
              transform: [
                { translateX: dolphinTranslateX },
                { translateY: dolphinTranslateY },
                { rotate: dolphinRotation },
                { scale: dolphinScale },
              ],
            },
          ]}
        >
          <DolphinIllustration width={dolphinWidth} height={dolphinHeight} />
        </Animated.View>
      </View>

      {/* Layer 3: Main Foreground UI Layout */}
      <View style={styles.contentContainer} pointerEvents="box-none">
        {/* Top-Right Language Selector (Always accessible) */}
        <View style={styles.topBarRow}>
          {onChangeLanguage && (
            <GlobeLanguagePill
              label={langLabel}
              onPress={onChangeLanguage}
              isDark={false}
            />
          )}
        </View>

        {/* Branding Header */}
        <Animated.View
          style={[
            styles.brandHeaderContainer,
            {
              opacity: animHeaderOpacity,
              transform: [{ translateY: animHeaderTranslate }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>{t('welcomeTitle', currentLanguage)}</Text>
          <Text style={styles.brandSubtitle}>
            {t('welcomeSubtitle', currentLanguage)}
          </Text>
        </Animated.View>

        {/* Flexible Spacer for Visual Ocean & Jumping Dolphin */}
        <View style={styles.animationSpacer} pointerEvents="box-none" />

        {/* Bottom Area: Seamless Overlapping Tagline VS Final Feature Content */}
        <View style={styles.bottomSection}>
          {/* A. Animated Intro Tagline & Progress Indicators (Stages 1-5) */}
          <Animated.View
            pointerEvents={isInteractive ? 'none' : 'auto'}
            style={[
              styles.taglineContainer,
              {
                opacity: animTaglineOpacity,
              },
            ]}
          >
            <Text style={styles.taglineTitle}>
              {t('ourOceanOurPeople', currentLanguage)}
            </Text>
            <Text style={styles.taglineSub}>
              {t('aSaferTomorrow', currentLanguage)}
            </Text>

            {/* 4 Subtle Progress Dots */}
            <View style={styles.dotsRow}>
              {[1, 2, 3, 4].map((dotIndex) => {
                const isActive =
                  animationStage === dotIndex ||
                  (animationStage >= 4 && dotIndex === 4);
                return (
                  <View
                    key={dotIndex}
                    style={[styles.dot, isActive && styles.dotActive]}
                  />
                );
              })}
            </View>
          </Animated.View>

          {/* B. Final State (Stage 6): Large Glassmorphic GET STARTED Button */}
          <Animated.View
            pointerEvents={isInteractive ? 'auto' : 'none'}
            style={[
              styles.finalContentContainer,
              {
                opacity: animFinalContentOpacity,
                transform: [{ translateY: animFinalContentTranslate }],
              },
            ]}
          >
            {/* Large Glassmorphic Pill Button */}
            <TouchableOpacity
              style={styles.getStartedBtn}
              onPress={handleDirectGetStarted}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('getStarted', currentLanguage)}
            >
              {/* Subtle Glassmorphic Top Gloss Highlight */}
              <View style={styles.glassHighlight} pointerEvents="none" />
              <Text style={styles.getStartedBtnText}>
                {t('getStarted', currentLanguage)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Role / Login Portal Selection Modal (Preserved & Styled) */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>SELECT LOGIN PORTAL</Text>
              <TouchableOpacity
                onPress={() => setShowRoleModal(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Text style={styles.closeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Choose your account portal to proceed to login:
            </Text>

            {/* 1. Fisherman Login Option */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.portalOptionBtn}
              onPress={() => {
                setShowRoleModal(false);
                onGetStarted();
              }}
            >
              <View style={styles.portalIconWrapper}>
                <NavigationIcon size={24} color="#005F60" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.portalOptionTitle}>Fisherman Login</Text>
                <Text style={styles.portalOptionSub}>
                  Sea navigation, PFZ zones & weather
                </Text>
              </View>
              <View style={styles.portalArrowBadge}>
                <ArrowRightIcon size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* 2. Coastal Guard Login Option */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.portalOptionBtn, styles.portalOptionBtnCG]}
              onPress={() => {
                setShowRoleModal(false);
                if (onOpenCoastalGuard) {
                  onOpenCoastalGuard();
                }
              }}
            >
              <View style={[styles.portalIconWrapper, styles.portalIconWrapperCG]}>
                <ShieldIcon size={24} color="#0F3A5D" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={[styles.portalOptionTitle, { color: '#0F3A5D' }]}>
                  Coastal Guard Login
                </Text>
                <Text style={styles.portalOptionSub}>
                  Samudra Kural command & maritime rescue
                </Text>
              </View>
              <View style={[styles.portalArrowBadge, { backgroundColor: '#0F3A5D' }]}>
                <ArrowRightIcon size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6F5F6',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 22,
    zIndex: 2,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    minHeight: 34,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#9DDCD6',
    shadowColor: '#004A4C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  langPillDark: {
    backgroundColor: '#E0F4F2',
    borderColor: '#80CCC4',
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#004A4C',
    marginLeft: 5,
  },
  langPillTextDark: {
    color: '#004A4C',
  },
  brandHeaderContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#082526',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#285556',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 290,
  },
  animationSpacer: {
    flex: 1,
    width: '100%',
  },
  dolphinWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Platform.OS === 'ios' ? 36 : 28,
  },

  // ─── STAGE 1-5 INTRO TAGLINE & PROGRESS DOTS ───
  taglineContainer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    width: '100%',
  },
  taglineTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D2FBF7',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  taglineSub: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A0EDE5',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38DFD0',
    shadowColor: '#38DFD0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  // ─── STAGE 6 FINAL CONTENT: WHITE PILL BUTTON ───
  finalContentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    width: '88%',
    maxWidth: 340,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.8,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#002B2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  getStartedBtnText: {
    color: '#062E30',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },

  // ─── LOGIN PORTAL MODAL ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 27, 30, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#BFE7E3',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#082526',
    letterSpacing: 0.8,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  modalSub: {
    fontSize: 14,
    color: '#385859',
    marginBottom: 18,
    fontWeight: '600',
  },
  portalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7F5',
    borderColor: '#007073',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  portalOptionBtnCG: {
    backgroundColor: '#EEF5FA',
    borderColor: '#0F3A5D',
  },
  portalIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  portalIconWrapperCG: {
    backgroundColor: '#DCE8F2',
  },
  optionTextCol: {
    flex: 1,
  },
  portalOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#005F60',
    marginBottom: 2,
  },
  portalOptionSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B6B6C',
  },
  portalArrowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#005F60',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
