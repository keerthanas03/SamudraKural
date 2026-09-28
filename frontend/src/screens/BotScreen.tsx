import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Colors } from '../theme/colors';
import { SupportedLanguage } from '../types';
import { useLanguage } from '../i18n';
import { BottomNavBar } from '../components/BottomNavBar';
import {
  askOrcaBot,
  OrcaChatResponse,
  HotspotSummary,
  transcribeAudio,
  synthesizeSpeech,
  getSessionChatMessages,
  saveSessionChatMessages,
  clearSessionChatMessages,
  BotChatMessage,
} from '../services/botService';
import {
  speakNativeText,
  stopNativeSpeech,
  requestMicrophonePermission,
  startRealAudioRecording,
  stopRealAudioRecording,
  cancelAudioRecording,
  cleanSpeechText,
  cleanAnswerForTTS,
} from '../utils/speech';

const { width } = Dimensions.get('window');

type ChatMessage = BotChatMessage;

interface BotScreenProps {
  currentLanguage?: SupportedLanguage;
  onBack?: () => void;
  onNavigateToHotspot?: (spot: any) => void;
  onTabPress?: (tabId: string) => void;
  hideTopHeader?: boolean;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  ta: [
    'சென்னை கடலில் நாளை நான் மீன்பிடிக்க போகலாமா?',
    'சிறந்த கானாங்களுத்தி மீன்பிடி மண்டலம் எங்கே?',
    'காற்றின் வேகம் மற்றும் அலை உயரம் எவ்வளவு?',
    'தொலைந்த வலை எங்கே மிதந்து கொண்டிருக்கும்?',
    'புயல் அல்லது ஆபத்து எச்சரிக்கை உள்ளதா?',
  ],
  te: [
    'రేపు చెన్నై నుండి చేపల వేటకు వెళ్ళవచ్చా?',
    'సమీపంలో ఉన్న ఉత్తమ చేపల వేట ప్రాంతం ఎక్కడ ఉంది?',
    'గాలి వేగం మరియు అలల ఎత్తు ఎంత?',
    'నా పోయిన వల ఎక్కడ కొట్టుకుపోతోంది?',
  ],
  ml: [
    'എനിക്ക് നാളെ ചെന്നൈയിൽ നിന്ന് മീൻപിടിക്കാൻ പോകാൻ സാധിക്കുമോ?',
    'അടുത്തുള്ള മികച്ച മത്സ്യബന്ധന മേഖല എവിടെയാണ്?',
    'കാറ്റിന്റെ വേഗതയും തിരമാല ഉയരവും എത്രയാണ്?',
  ],
  hi: [
    'क्या मैं कल चेन्नई से मछली पकड़ने जा सकता हूँ?',
    'निकटतम सर्वोत्तम मत्स्य क्षेत्र कहाँ है?',
    'हवा की गति और लहरों की ऊँचाई कितनी है?',
  ],
  mr: [
    'मी उद्या मासेमारीसाठी समुद्रात जाऊ शकतो का?',
    'जवळचे सर्वोत्तम मासेमारी क्षेत्र कुठे आहे?',
    'वाऱ्याचा वेग आणि लाटांची उंची किती आहे?',
  ],
  gu: [
    'શું હું આવતીકાલે માછીમારી માટે જઈ શકું?',
    'નજીકનો શ્રેષ્ઠ માછીમારી વિસ્તાર ક્યાં છે?',
    'પવનની ગતિ અને મોજાની ઊંચાઈ કેટલી છે?',
  ],
  or: [
    'ମୁଁ ଆସନ୍ତାକାଲି ମାଛ ଧରିବାକୁ ଯାଇପାରିବି କି?',
    'ନିକଟତମ ସର୍ବୋତ୍ତମ ମତ୍ସ୍ୟ କ୍ଷେତ୍ର କେଉଁଠାରେ ଅଛି?',
    'ପବନର ଗତି ଏବଂ ତରଙ୍ଗର ଉଚ୍ଚତା କେତେ?',
  ],
  kn: [
    'ನಾನು ನಾಳೆ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ?',
    'ಹತ್ತಿರದ ಅತ್ಯುತ್ತಮ ಮೀನುಗಾರಿಕಾ ವಲಯ ಎಲ್ಲಿದೆ?',
    'ಗಾಳಿಯ ವೇಗ ಮತ್ತು ಅಲೆಗಳ ಎತ್ತರ ಎಷ್ಟು?',
  ],
  bn: [
    'আমি কি আগামীকাল মাছ ধরতে যেতে পারি?',
    'কাছাকাছি সেরা মাছ ধরার অঞ্চল কোথায়?',
    'বাতাসের গতি এবং ঢেউয়ের উচ্চতা কত?',
  ],
  en: [
    'Can I go fishing tomorrow from Chennai, and where should I go?',
    'Where is the nearest best Mackerel potential fishing zone?',
    'What is the live wind speed and wave height?',
    'Where is my lost net drifting from 13.08N, 80.38E?',
  ],
};

export const BotScreen: React.FC<BotScreenProps> = ({
  currentLanguage,
  onBack,
  onNavigateToHotspot,
  onTabPress,
  hideTopHeader = false,
}) => {
  const { language: globalLang, setLanguage, t } = useLanguage();
  const lang = (globalLang || currentLanguage || 'en') as SupportedLanguage;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = getSessionChatMessages();
    if (saved && saved.length > 0) {
      return saved;
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'bot',
        text: t('botWelcome'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState({ lat: 13.0827, lon: 80.3800 });

  const scrollViewRef = useRef<ScrollView>(null);
  const micPulseAnim = useRef(new Animated.Value(1)).current;

  // Persist messages in session memory whenever messages state changes
  useEffect(() => {
    if (messages && messages.length > 0) {
      saveSessionChatMessages(messages);
    }
  }, [messages]);

  useEffect(() => {
    // Fetch live device location for precise agent calculations
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((loc) => {
            if (loc && loc.coords) {
              setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
            }
          })
          .catch(() => {});
      }
    });
  }, []);

  // Stop audio speech when navigating away from screen
  useEffect(() => {
    return () => {
      stopNativeSpeech();
    };
  }, []);

  // Update welcome message when active language changes ONLY if chat is brand new
  useEffect(() => {
    const welcomeText = t('botWelcome');
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg-welcome') {
        const updated: ChatMessage[] = [
          {
            id: 'msg-welcome',
            sender: 'bot',
            text: welcomeText,
            timestamp: prev[0].timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
        saveSessionChatMessages(updated);
        return updated;
      }
      return prev;
    });
  }, [lang]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      micPulseAnim.setValue(1.0);
    }
  }, [isRecording]);

  const handleSend = async (queryText?: string, isVoiceInput: boolean = false, detectedLanguage?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || loading) return;

    const activeLanguage = detectedLanguage || lang;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice: isVoiceInput,
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!queryText) setInputText('');
    setLoading(true);

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await askOrcaBot(
        textToSend,
        userLocation.lat,
        userLocation.lon,
        'Trawler',
        activeLanguage
      );

      const botMsgId = `bot-${Date.now()}`;
      const botMsg: ChatMessage = {
        id: botMsgId,
        sender: 'bot',
        text: response.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        botData: response,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Automatically speak native speech if user asked via Voice
      if (isVoiceInput && (response.voice_speech_text || response.response_text)) {
        handlePlaySpeech(
          botMsgId,
          response.voice_speech_text || response.response_text,
          response.voice_audio_base64,
          response.language || activeLanguage
        );
      }
    } catch (error) {
      console.error('Error fetching ORCA bot response:', error);
      Alert.alert('ORCA Bot', 'Failed to reach AI agents. Please check connection.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const handleVoiceRecordToggle = async () => {
    if (isRecording) {
      // User tapped Stop
      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const audioData = await stopRealAudioRecording();
        if (!audioData) {
          Alert.alert('Voice Input', 'No voice audio was captured. Please try speaking again.');
          setIsTranscribing(false);
          return;
        }

        if (audioData.durationMs && audioData.durationMs < 300) {
          console.log('Recording too short, using quick query');
        }

        // Allow STT to accurately detect spoken language (Tamil, English, Hindi, Telugu, etc.)
        const res = await transcribeAudio(audioData, lang || 'unknown');
        setIsTranscribing(false);

        const recognizedText = res?.transcript?.trim();
        if (!recognizedText) {
          Alert.alert('Voice Input', 'Could not clearly recognize speech. Please speak closer to the microphone and try again.');
          return;
        }

        const detectedLang = res?.language && res.language !== 'unknown' ? res.language : (lang || 'ta');
        console.log('[Voice STT] Exact Recognized Spoken Words:', recognizedText, 'Language:', detectedLang);
        
        // Synchronize active language tab if speaker spoke a different language
        if (detectedLang && detectedLang !== lang) {
          try {
            setLanguage(detectedLang as SupportedLanguage);
          } catch (e) {}
        }

        // Automatically send exact recognized voice question to ORCA
        handleSend(recognizedText, true, detectedLang);
      } catch (err: any) {
        console.log('[STT Notice]', err?.message || err);
        setIsTranscribing(false);
        Alert.alert('Voice Input', err?.message || 'Could not recognize speech. Please speak clearly into the microphone.');
      }
      return;
    }

    // User tapped Record
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          'Microphone Permission Required',
          'Microphone permission is required for voice input.'
        );
        return;
      }

      await startRealAudioRecording(lang || 'ta');
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start audio recording:', err);
      Alert.alert('Microphone Error', err.message || 'Could not access microphone.');
      setIsRecording(false);
    }
  };

  const handlePlaySpeech = async (
    msgId: string,
    speechText: string,
    existingBase64?: string,
    spokenLang?: string
  ) => {
    if (isSpeaking === msgId) {
      await stopNativeSpeech();
      setIsSpeaking(null);
      return;
    }

    await stopNativeSpeech();
    setIsSpeaking(null);

    const activeSpeechLang = spokenLang || lang;
    const cleanSpeech = cleanAnswerForTTS(speechText);
    let audioToPlay = existingBase64;

    // If audio is not yet synthesized, fetch from Sarvam TTS backend
    if (!audioToPlay) {
      setTtsLoadingId(msgId);
      try {
        const res = await synthesizeSpeech(cleanSpeech, activeSpeechLang);
        if (res.status === 'success' && res.audio_base64) {
          audioToPlay = res.audio_base64;
          // Cache audio in message state so future taps play instantly
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId && m.botData
                ? { ...m, botData: { ...m.botData, voice_audio_base64: audioToPlay } }
                : m
            )
          );
        }
      } catch (err) {
        console.warn('Sarvam TTS synthesis error:', err);
      } finally {
        setTtsLoadingId(null);
      }
    }

    setIsSpeaking(msgId);
    speakNativeText(
      cleanSpeech,
      activeSpeechLang,
      () => setIsSpeaking(msgId),
      () => setIsSpeaking(null),
      audioToPlay
    );
  };

  const handleCopyHotspot = async (spot: HotspotSummary) => {
    const coordStr = `${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}`;
    await Clipboard.setStringAsync(coordStr);
    Alert.alert('GPS Copied! 📋', `Coordinates (${coordStr}) copied to clipboard.`);
  };

  const handleNavigateMap = (spot: HotspotSummary) => {
    if (onNavigateToHotspot) {
      onNavigateToHotspot({
        id: 'HOTSPOT_BOT_SEL',
        name: spot.name,
        latitude: spot.latitude,
        longitude: spot.longitude,
        sst_celsius: 28.5,
        chlorophyll_mg_m3: 1.2,
        depth_meters: spot.depth_meters,
        target_species: spot.target_species,
        reliability_score: '96%',
        valid_until: '24 Hours',
        distance_meters: spot.distance_km * 1000,
        bearing_degrees: spot.bearing_deg,
        direction: spot.cardinal_direction,
      });
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear your active conversation history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearSessionChatMessages();
            const resetMsg: ChatMessage[] = [
              {
                id: 'msg-welcome',
                sender: 'bot',
                text: t('botWelcome'),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ];
            setMessages(resetMsg);
            saveSessionChatMessages(resetMsg);
          },
        },
      ]
    );
  };

  const currentPrompts = QUICK_PROMPTS[lang] || QUICK_PROMPTS['ta'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header Banner - Only shown when BotScreen is standalone (not inside HomeScreen tab) */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            {onBack && (
              <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                <Text style={styles.backBtnTxt}>←</Text>
              </TouchableOpacity>
            )}
            <Image
              source={require('../../assets/chatbot-logo.png')}
              style={styles.headerLogo}
              resizeMode="cover"
            />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{t('askBot')}</Text>
              <Text style={styles.headerSubtitle}>Real-Time Satellite & Marine Intelligence</Text>
            </View>
          </View>

          <View style={styles.headerRightRow}>
            {messages.length > 1 && (
              <TouchableOpacity
                style={styles.clearChatBtn}
                onPress={handleClearChat}
                activeOpacity={0.7}
              >
                <Text style={styles.clearChatTxt}>🗑️ Clear</Text>
              </TouchableOpacity>
            )}
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineDot}>🟢</Text>
              <Text style={styles.onlineText}>12 LIVE</Text>
            </View>
          </View>
        </View>
      )}

      {/* Language Selector Chips */}
      <View style={styles.langBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langBarContent}
        >
          {[
            { code: 'en', label: 'English' },
            { code: 'ta', label: 'தமிழ்' },
            { code: 'hi', label: 'हिन्दी' },
            { code: 'mr', label: 'मराठी' },
            { code: 'gu', label: 'ગુજરાતી' },
            { code: 'or', label: 'ଓଡ଼ିଆ' },
            { code: 'te', label: 'తెలుగు' },
            { code: 'ml', label: 'മലയാളം' },
            { code: 'kn', label: 'ಕನ್ನಡ' },
            { code: 'bn', label: 'বাংলা' },
          ].map((item) => (
            <TouchableOpacity
              key={item.code}
              style={[styles.langChip, lang === item.code && styles.langChipActive]}
              onPress={() => setLanguage(item.code as SupportedLanguage)}
            >
              <Text style={[styles.langChipTxt, lang === item.code && styles.langChipTxtActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable Message List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const data = msg.botData;

          return (
            <View key={msg.id} style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperBot]}>
              {/* User Bubble */}
              {isUser ? (
                <View style={styles.userBubble}>
                  <View style={styles.userBubbleHeader}>
                    <Text style={styles.userBubbleTxt}>{msg.text}</Text>
                    {msg.isVoice && <Text style={styles.voiceBadge}>{t('spokenVoiceBadge')}</Text>}
                  </View>
                  <Text style={styles.userTimeTxt}>{msg.timestamp}</Text>
                </View>
              ) : (
                /* Bot Card */
                <View style={styles.botCard}>
                  {/* Risk Assessment Top Banner */}
                  {data && data.risk_assessment && (
                    <View style={[styles.riskBanner, { backgroundColor: data.risk_assessment.color }]}>
                      <Text style={styles.riskIcon}>
                        {data.risk_assessment.level === 'HIGH'
                          ? '🚨'
                          : data.risk_assessment.level === 'MODERATE'
                          ? '⚠️'
                          : '✅'}
                      </Text>
                      <View style={styles.riskTxtContainer}>
                        <Text style={styles.riskTitle}>{data.risk_assessment.title}</Text>
                        <Text style={styles.riskReason}>{data.risk_assessment.reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Message Main Body Text */}
                  <Text style={styles.botCardTxt}>{msg.text}</Text>

                  {/* Native Language Audio Playback Speaker Button */}
                  {data && (data.response_text || data.voice_speech_text) && (
                    <TouchableOpacity
                      style={[
                        styles.voicePlayBtn,
                        isSpeaking === msg.id && styles.voicePlayBtnActive,
                        ttsLoadingId === msg.id && { opacity: 0.8 },
                      ]}
                      disabled={ttsLoadingId === msg.id}
                      onPress={() =>
                        handlePlaySpeech(
                          msg.id,
                          data.voice_speech_text || data.response_text || msg.text,
                          data.voice_audio_base64,
                          data.language || lang
                        )
                      }
                    >
                      {ttsLoadingId === msg.id ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator size="small" color={Colors.primaryDark} />
                          <Text style={styles.voicePlayIcon}>⏳ {t('playingAudio') || 'Generating voice...'}</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.voicePlayIcon}>
                            {isSpeaking === msg.id ? t('stopVoice') : t('listenNativeVoice')}
                          </Text>
                          <Text style={styles.voicePlaySub}>
                            {isSpeaking === msg.id ? t('playingAudio') : t('ttsSub')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Real-Time Ocean / Inland Telemetry Grid */}
                  {data && data.telemetry && (
                    <View style={styles.telemetrySection}>
                      <Text style={styles.secHeading}>
                        📡 {data.telemetry.is_inland ? 'Inland Atmospheric Telemetry' : t('liveTelemetryHeading')}
                      </Text>
                      <View style={styles.telemGrid}>
                        <View style={styles.telemCell}>
                          <Text style={styles.telemIcon}>💨</Text>
                          <Text style={styles.telemVal}>{data.telemetry.wind_kmh} km/h</Text>
                          <Text style={styles.telemLabel}>{t('wind')} ({data.telemetry.wind_direction})</Text>
                        </View>
                        <View style={styles.telemCell}>
                          <Text style={styles.telemIcon}>{data.telemetry.is_inland ? '🌧️' : '🌊'}</Text>
                          <Text style={styles.telemVal}>
                            {data.telemetry.is_inland
                              ? `${data.telemetry.rain_probability_pct ?? 0}%`
                              : `${data.telemetry.wave_height_m ?? 0.0} m`}
                          </Text>
                          <Text style={styles.telemLabel}>
                            {data.telemetry.is_inland ? 'Rain Probability' : t('waveHeight')}
                          </Text>
                        </View>
                        <View style={styles.telemCell}>
                          <Text style={styles.telemIcon}>🌡️</Text>
                          <Text style={styles.telemVal}>
                            {data.telemetry.is_inland
                              ? `${data.telemetry.air_temperature_c ?? 30.0}°C`
                              : `${data.telemetry.sea_surface_temp_c || 28.3}°C`}
                          </Text>
                          <Text style={styles.telemLabel}>
                            {data.telemetry.is_inland ? 'Air Temp' : t('seaSurfaceTempLabel')}
                          </Text>
                        </View>
                        <View style={styles.telemCell}>
                          <Text style={styles.telemIcon}>🚤</Text>
                          <Text style={styles.telemVal}>
                            {data.telemetry.is_inland
                              ? '0.0 kts'
                              : (data.telemetry.ocean_current_knots !== undefined && data.telemetry.ocean_current_knots !== null
                                  ? `${data.telemetry.ocean_current_knots} kts`
                                  : '0.0 kts')}
                          </Text>
                          <Text style={styles.telemLabel}>
                            {data.telemetry.is_inland
                              ? 'Boat Speed (On Land)'
                              : `${t('oceanCurrentLabel')} (${data.telemetry.ocean_current_direction || 'NE'})`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Suggested Hotspot Card */}
                  {data && data.suggested_hotspot && (
                    <View style={styles.hotspotCard}>
                      <View style={styles.hotspotCardTop}>
                        <Text style={styles.hotspotIcon}>🐟</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.hotspotName}>{data.suggested_hotspot.name}</Text>
                          <Text style={styles.hotspotSub}>
                            📍 {data.suggested_hotspot.distance_km} km {data.suggested_hotspot.cardinal_direction} | {t('depth')}: {data.suggested_hotspot.depth_meters}{t('meters')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.speciesRow}>
                        {data.suggested_hotspot.target_species.map((sp, idx) => (
                          <View key={idx} style={styles.speciesBadge}>
                            <Text style={styles.speciesBadgeTxt}>🎣 {sp}</Text>
                          </View>
                        ))}
                      </View>

                      <TouchableOpacity
                        style={styles.navMapBtn}
                        activeOpacity={0.8}
                        onPress={() => handleNavigateMap(data.suggested_hotspot!)}
                      >
                        <Text style={styles.navMapBtnTxt}>🧭 {t('showRouteOceanMap')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.botTimeTxt}>{msg.timestamp} • Real-time satellite query</Text>
                </View>
              )}
            </View>
          );
        })}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingTxt}>
              🌊 Samudra Kural is analyzing real-time ocean & weather conditions...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Voice Recording Overlay Notice */}
      {isRecording && (
        <View style={styles.recordingBar}>
          <Animated.View style={[styles.recDot, { transform: [{ scale: micPulseAnim }] }]} />
          <Text style={styles.recTxt}>
            🔴 Recording voice... Tap mic button to stop
          </Text>
        </View>
      )}

      {/* Voice Transcribing Notice */}
      {isTranscribing && (
        <View style={[styles.recordingBar, { backgroundColor: '#2563EB' }]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.recTxt}>
            ⏳ Transcribing voice with Sarvam AI...
          </Text>
        </View>
      )}

      {/* Quick Action Suggestion Chips Bar */}
      <View style={styles.quickPromptsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsRow}>
          {currentPrompts.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickChip}
              onPress={() => handleSend(prompt, false)}
            >
              <Text style={styles.quickChipTxt}>💡 {prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Voice & Text Input Bar */}
      <View style={[
        styles.inputContainer,
        hideTopHeader && styles.inputContainerEmbedded
      ]}>
        {/* Microphone Button */}
        <TouchableOpacity
          style={[
            styles.micBtn,
            isRecording && styles.micBtnActive,
            isTranscribing && { backgroundColor: '#64748B', borderColor: '#475569' },
          ]}
          activeOpacity={0.8}
          disabled={isTranscribing}
          onPress={handleVoiceRecordToggle}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.micIcon}>{isRecording ? '⏹️' : '🎙️'}</Text>
          )}
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          placeholder={t('askMarineQuestionPlaceholder')}
          placeholderTextColor={Colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          disabled={!inputText.trim() || loading}
          onPress={() => handleSend()}
        >
          <Text style={styles.sendIcon}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Bottom Navigation Bar - Only when standalone (HomeScreen already provides the bottom bar) */}
      {!hideTopHeader && (
        <BottomNavBar
          activeTab="bot"
          onTabPress={(tabId) => {
            if (onTabPress) {
              onTabPress(tabId);
            } else if (tabId === 'home' || tabId === 'nets') {
              if (onBack) onBack();
            } else if (tabId === 'sos') {
              Alert.alert(t('emergencySosTitle'), t('emergencySosMsg'));
            }
          }}
          currentLanguage={lang as SupportedLanguage}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    padding: 6,
  },
  backBtnTxt: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  headerTitleContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearChatBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  clearChatTxt: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 4,
  },
  onlineDot: {
    fontSize: 10,
  },
  onlineText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  langBar: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  langBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  langChipTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  langChipTxtActive: {
    color: '#FFFFFF',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 110,
  },
  msgWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  msgWrapperUser: {
    alignItems: 'flex-end',
  },
  msgWrapperBot: {
    alignItems: 'flex-start',
  },
  userBubble: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 14,
    maxWidth: '85%',
  },
  userBubbleHeader: {
    flexDirection: 'column',
    gap: 4,
  },
  userBubbleTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  voiceBadge: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  userTimeTxt: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  botCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    maxWidth: '92%',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  riskIcon: {
    fontSize: 22,
  },
  riskTxtContainer: {
    flex: 1,
  },
  riskTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  riskReason: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  botCardTxt: {
    color: Colors.text,
    fontSize: 14.5,
    lineHeight: 23,
    fontWeight: '500',
    letterSpacing: 0.15,
    marginBottom: 14,
  },
  voicePlayBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
  },
  voicePlayBtnActive: {
    backgroundColor: '#FDE68A',
  },
  voicePlayIcon: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  voicePlaySub: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  telemetrySection: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  telemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemCell: {
    width: '48%',
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  telemIcon: {
    fontSize: 14,
  },
  telemVal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  telemLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  hotspotCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
  },
  hotspotCardTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  hotspotIcon: {
    fontSize: 24,
  },
  hotspotName: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  hotspotSub: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  speciesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  speciesBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speciesBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  navMapBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navMapBtnTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  botTimeTxt: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  recTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  quickPromptsSection: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickPromptsRow: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChip: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputContainerEmbedded: {
    paddingBottom: Platform.OS === 'ios' ? 86 : 76,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#B91C1C',
  },
  micIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
