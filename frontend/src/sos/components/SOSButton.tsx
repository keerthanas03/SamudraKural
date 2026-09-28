import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';

interface SOSButtonProps {
  onHoldSuccess: () => void;
  disabled?: boolean;
  holdDurationMs?: number;
}

export const SOSButton: React.FC<SOSButtonProps> = ({
  onHoldSuccess,
  disabled = false,
  holdDurationMs = 3000,
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    // Pulse animation when idle
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    if (disabled) return;

    setIsHolding(true);
    setCountdownSeconds(3);
    progressAnim.setValue(0);

    // Haptic feedback on start hold if available
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        Vibration.vibrate(50);
      }
    } catch (e) {}

    // Animate progress fill over holdDurationMs
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: holdDurationMs,
      useNativeDriver: false,
    }).start();

    // Interval for countdown display
    let remaining = 3;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining >= 1) {
        setCountdownSeconds(remaining);
      }
    }, 1000);

    // Success timer
    timerRef.current = setTimeout(() => {
      cleanupTimers();
      setIsHolding(false);
      progressAnim.setValue(0);
      try {
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          Vibration.vibrate([0, 100, 50, 100]);
        }
      } catch (e) {}
      onHoldSuccess();
    }, holdDurationMs);
  };

  const handlePressOut = () => {
    if (!isHolding) return;
    cleanupTimers();
    setIsHolding(false);
    setCountdownSeconds(3);

    // Reset progress animation smoothly
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const cleanupTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.buttonOuterRing,
          !disabled && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityLabel="Hold for 3 seconds to send emergency SOS"
          accessibilityRole="button"
          style={[styles.buttonInner, disabled && styles.buttonDisabled]}
        >
          {/* Progress fill bar inside button */}
          <Animated.View
            style={[
              styles.progressFill,
              { width: widthInterpolate },
            ]}
          />

          <View style={styles.contentContainer}>
            <Text style={styles.sosEmoji}>🆘</Text>
            <Text style={styles.sosTitleText}>
              {disabled ? 'SENDING SOS...' : isHolding ? 'HOLD SOS' : 'HOLD TO SEND SOS'}
            </Text>
            
            <Text style={styles.sosSubtitleText}>
              {disabled
                ? 'Processing Emergency Alert'
                : isHolding
                ? `Hold for ${countdownSeconds} second${countdownSeconds > 1 ? 's' : ''}...`
                : 'Press & Hold for 3 Seconds'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  buttonOuterRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(192, 57, 43, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(192, 57, 43, 0.3)',
  },
  buttonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
    backgroundColor: '#C0392B', // High contrast red for emergency
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#C0392B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#902B20',
  },
  buttonDisabled: {
    backgroundColor: '#7F8C8D',
    borderColor: '#566573',
    shadowOpacity: 0.1,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#E74C3C',
    opacity: 0.85,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 16,
  },
  sosEmoji: {
    fontSize: 42,
    marginBottom: 4,
  },
  sosTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sosSubtitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD7D7',
    marginTop: 4,
    textAlign: 'center',
  },
});
