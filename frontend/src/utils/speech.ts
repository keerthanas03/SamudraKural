import { Platform } from 'react-native';

// Safe dynamic imports that will NEVER throw fatal top-level native module crashes
let ExpoSpeech: any = null;
try {
  ExpoSpeech = require('expo-speech');
} catch (e) {
  ExpoSpeech = null;
}

let ExpoAudio: any = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  ExpoAudio = null;
}

let ExpoAV: any = null;
try {
  ExpoAV = require('expo-av');
} catch (e) {
  ExpoAV = null;
}

const LANGUAGE_VOICE_MAP: Record<string, string> = {
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
  en: 'en-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  or: 'od-IN',
  kn: 'kn-IN',
  bn: 'bn-IN',
};

export type RecordingState = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'TRANSCRIBED' | 'ERROR';

export interface RecordedAudioResult {
  uri?: string;
  blob?: Blob;
  durationMs: number;
  fileSizeBytes?: number;
  mimeType: string;
  filename: string;
}

let activeAudioElement: any = null;
let activeRecordingState: RecordingState = 'IDLE';
let recordingStartTime: number = 0;
let activeExpoAudioRecorder: any = null;
let activeExpoAvRecording: any = null;
let webMediaRecorder: any = null;
let webAudioChunks: Blob[] = [];
let activeSpeechRecognition: any = null;
let recognizedWebSpeechText: string = '';

export function getRecognizedWebSpeechText(): string {
  return recognizedWebSpeechText;
}

export function getRecordingState(): RecordingState {
  return activeRecordingState;
}

let activeNativePlayer: any = null;

export async function playBase64Audio(
  base64Audio: string,
  onStart?: () => void,
  onDone?: () => void
): Promise<boolean> {
  if (!base64Audio || !base64Audio.trim()) return false;

  try {
    await stopNativeSpeech();

    const dataUri = `data:audio/wav;base64,${base64Audio}`;

    // Web Playback
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const AudioConstructor = (window as any).Audio;
      if (AudioConstructor) {
        const audio = new AudioConstructor(dataUri);
        activeAudioElement = audio;
        if (onStart) onStart();
        audio.onended = () => {
          activeAudioElement = null;
          if (onDone) onDone();
        };
        audio.onerror = () => {
          activeAudioElement = null;
          if (onDone) onDone();
        };
        audio.play().catch(() => {
          activeAudioElement = null;
          if (onDone) onDone();
        });
        return true;
      }
    }

    // Native Playback via expo-audio (Expo SDK 57 / Expo Go)
    if (ExpoAudio && (ExpoAudio.createAudioPlayer || ExpoAudio.AudioModule?.AudioPlayer)) {
      try {
        if (ExpoAudio.setAudioModeAsync) {
          await ExpoAudio.setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
          });
        }

        let player: any = null;
        if (ExpoAudio.createAudioPlayer) {
          player = ExpoAudio.createAudioPlayer(dataUri);
        } else if (ExpoAudio.AudioModule?.AudioPlayer) {
          player = new ExpoAudio.AudioModule.AudioPlayer(dataUri, 500, false, 0);
        }

        if (player) {
          activeNativePlayer = player;
          if (onStart) onStart();

          player.addListener('playbackStatusUpdate', (status: any) => {
            if (status.isLoaded && !status.playing && status.currentTime > 0 && status.duration > 0 && Math.abs(status.currentTime - status.duration) < 0.6) {
              if (activeNativePlayer === player) {
                activeNativePlayer = null;
              }
              try { player.remove(); } catch (e) {}
              if (onDone) onDone();
            }
          });

          player.play();
          return true;
        }
      } catch (err) {
        console.warn('[Voice Playback] expo-audio player failed, trying fallback:', err);
      }
    }

    // Native Playback Fallback via expo-av
    if (ExpoAV && ExpoAV.Audio && ExpoAV.Audio.Sound) {
      try {
        const { sound } = await ExpoAV.Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: true }
        );
        activeNativePlayer = sound;
        if (onStart) onStart();

        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            if (activeNativePlayer === sound) {
              activeNativePlayer = null;
            }
            sound.unloadAsync().catch(() => {});
            if (onDone) onDone();
          }
        });
        return true;
      } catch (err) {
        console.warn('[Voice Playback] expo-av Sound error:', err);
      }
    }
  } catch (err) {
    console.warn('Base64 audio playback failed:', err);
  }
  return false;
}

export function cleanSpeechText(rawText: string): string {
  if (!rawText) return '';
  
  // 1. Strip dataset citation footers / technical model sources so native TTS only reads user forecast & advisory
  let text = rawText.split(
    /📊|Integrated Real-Time Datasets|ஒருங்கிணைக்கப்பட்ட நேரலை தரவுத்தளங்கள்|సమగ్ర ప్రత్యక్ష డేటాసెట్‌లు|സംയോജിത തത്സമയ ഡാറ്റാസെറ്റുകൾ|एकीकृत लाइव डेटासेट्स/
  )[0];

  // 2. Remove markdown markers, emojis, and non-speech symbols
  text = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // Strip emojis for natural voice synthesis
    .replace(/[•●▪■◆★☆▶►📍💡⚠️✅🌦️💨🌊⚓🎣]/gu, '')
    .replace(/\|/g, ', ');

  // 3. Expand units and abbreviations for natural phonetic pronunciation across languages
  text = text
    .replace(/°C/g, ' degrees Celsius')
    .replace(/\bkm\/h\b/gi, ' kilometers per hour')
    .replace(/\bmm\b/gi, ' millimeters')
    .replace(/\bkts\b/gi, ' knots')
    .replace(/\bNM\b/g, ' nautical miles')
    .replace(/\bGPS\b/g, ' G P S ')
    .replace(/\bVHF\b/g, ' V H F ')
    .replace(/\bPFZ\b/g, ' P F Z ')
    .replace(/\bWSW\b/g, ' West-Southwest ')
    .replace(/\bWNW\b/g, ' West-Northwest ')
    .replace(/\bENE\b/g, ' East-Northeast ')
    .replace(/\bESE\b/g, ' East-Southeast ')
    .replace(/\bSSW\b/g, ' South-Southwest ')
    .replace(/\bSSE\b/g, ' South-Southeast ')
    .replace(/\bNNW\b/g, ' North-Northwest ')
    .replace(/\bNNE\b/g, ' North-Northeast ')
    .replace(/\bNE\b/g, ' Northeast ')
    .replace(/\bNW\b/g, ' Northwest ')
    .replace(/\bSE\b/g, ' Southeast ')
    .replace(/\bSW\b/g, ' Southwest ');

  // 4. Process line by line to ensure natural speech pauses at bullet points and line breaks
  const lines = text.split(/\r?\n/);
  const processedLines: string[] = [];

  for (let line of lines) {
    line = line.replace(/^[\s\-\*\>\:]+/, '').trim();
    if (!line) continue;
    // If the line doesn't end with terminal punctuation, add a period for natural speech cadence
    if (!/[.!?:,;।॥]$/.test(line)) {
      line += '.';
    }
    processedLines.push(line);
  }

  return processedLines.join(' ');
}

/**
 * Prepares clean natural text for TTS speech synthesis.
 * Strips formatting, markdown, debug labels, while keeping numbers and measurements intact.
 */
export function cleanAnswerForTTS(text: string): string {
  if (!text) return '';
  return cleanSpeechText(text)
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

/**
 * Splits long answer text into natural spoken sentence chunks under maxLen characters.
 */
export function chunkTextForTTS(text: string, maxLen: number = 1000): string[] {
  const cleaned = cleanAnswerForTTS(text);
  if (!cleaned || cleaned.length <= maxLen) return cleaned ? [cleaned] : [];

  const sentences = cleaned.split(/(?<=[.?!।॥\n])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [cleaned];
}

export async function speakNativeText(
  text: string,
  languageCode: string = 'ta',
  onStart?: () => void,
  onDone?: () => void,
  base64Audio?: string
): Promise<void> {
  const targetVoice = LANGUAGE_VOICE_MAP[languageCode] || 'en-IN';
  const speechText = cleanSpeechText(text);

  // Stop any current speaking instance
  await stopNativeSpeech();

  // 1. Prioritize playing synthesized high-fidelity base64 audio if present (Sarvam / ElevenLabs)
  if (base64Audio) {
    const played = await playBase64Audio(base64Audio, onStart, onDone);
    if (played) return;
  }

  // 2. Fallback to native high-quality device speech synthesizer
  if (onStart) onStart();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = targetVoice;
      utterance.rate = 0.75;
      utterance.onend = () => { if (onDone) onDone(); };
      utterance.onerror = () => { if (onDone) onDone(); };
      window.speechSynthesis.speak(utterance);
      return;
    } catch (err) {
      console.warn('Web SpeechSynthesis error:', err);
    }
  }

  if (ExpoSpeech && ExpoSpeech.speak) {
    try {
      ExpoSpeech.speak(speechText, {
        language: targetVoice,
        pitch: 1.0,
        rate: 0.72,
        onDone: () => { if (onDone) onDone(); },
        onError: () => { if (onDone) onDone(); },
      });
      return;
    } catch (err) {
      console.warn('ExpoSpeech speak error:', err);
    }
  }

  setTimeout(() => {
    if (onDone) onDone();
  }, 4000);
}

export async function stopNativeSpeech(): Promise<void> {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement = null;
    } catch (err) {}
  }

  if (activeNativePlayer) {
    try {
      if (activeNativePlayer.pause) activeNativePlayer.pause();
      if (activeNativePlayer.stop) activeNativePlayer.stop();
      if (activeNativePlayer.stopAsync) await activeNativePlayer.stopAsync();
      if (activeNativePlayer.unloadAsync) await activeNativePlayer.unloadAsync();
      if (activeNativePlayer.remove) activeNativePlayer.remove();
      activeNativePlayer = null;
    } catch (err) {
      activeNativePlayer = null;
    }
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {}
  }

  if (ExpoSpeech && ExpoSpeech.stop) {
    try {
      await ExpoSpeech.stop();
    } catch (err) {}
  }
}

/**
 * Request real device microphone permission.
 * Supports iOS, Android (Expo Go), and Web.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        console.log('[Voice Permission] Web mic permission granted');
        return true;
      } catch (err) {
        console.warn('[Voice Permission] Web microphone permission denied:', err);
        return false;
      }
    }
    return false;
  }

  // 1. ExpoAudio permission check (Expo SDK 57 / Expo Go)
  if (ExpoAudio && ExpoAudio.requestRecordingPermissionsAsync) {
    try {
      const res = await ExpoAudio.requestRecordingPermissionsAsync();
      const granted = !!(res.granted || res.status === 'granted');
      console.log('[Voice Permission] ExpoAudio permission result:', granted, res.status);
      return granted;
    } catch (err) {
      console.warn('[Voice Permission] ExpoAudio requestRecordingPermissionsAsync failed:', err);
    }
  }

  // 2. ExpoAV permission fallback
  if (ExpoAV && ExpoAV.Audio && ExpoAV.Audio.requestPermissionsAsync) {
    try {
      const res = await ExpoAV.Audio.requestPermissionsAsync();
      const granted = !!(res.granted || res.status === 'granted');
      console.log('[Voice Permission] ExpoAV permission result:', granted, res.status);
      return granted;
    } catch (err) {
      console.warn('[Voice Permission] ExpoAV requestPermissionsAsync failed:', err);
    }
  }

  return true;
}

/**
 * Start actual microphone recording.
 * Uses expo-audio on Android / Expo Go, expo-av fallback, and MediaRecorder on Web.
 */
export async function startRealAudioRecording(language: string = 'ta'): Promise<void> {
  if (activeRecordingState === 'RECORDING') {
    console.warn('[Voice Recording] Already recording, ignoring duplicate start.');
    return;
  }

  await stopNativeSpeech();
  activeRecordingState = 'RECORDING';
  recordingStartTime = Date.now();
  recognizedWebSpeechText = '';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.lang = LANGUAGE_VOICE_MAP[language] || 'ta-IN';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event: any) => {
            let text = '';
            for (let i = 0; i < event.results.length; i++) {
              text += event.results[i][0].transcript;
            }
            if (text && text.trim()) {
              recognizedWebSpeechText = text.trim();
              console.log('[Web Speech Recognition] Live recognized text:', recognizedWebSpeechText);
            }
          };
          recognition.start();
          activeSpeechRecognition = recognition;
        } catch (err) {
          console.log('[Web Speech Recognition] Note:', err);
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webAudioChunks = [];
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        webMediaRecorder = mediaRecorder;
        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            webAudioChunks.push(event.data);
          }
        };
        mediaRecorder.start(100);
        console.log('[Voice Recording] Web MediaRecorder started at:', new Date().toISOString());
        return;
      } catch (err) {
        activeRecordingState = 'ERROR';
        console.error('[Voice Recording] Web MediaRecorder start error:', err);
        throw err;
      }
    }
    activeRecordingState = 'ERROR';
    throw new Error('Microphone recording not supported in this browser environment.');
  }

  // Native recording via expo-audio (Modern Expo SDK 57 / Expo Go)
  if (ExpoAudio) {
    try {
      if (ExpoAudio.setAudioModeAsync) {
        await ExpoAudio.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        });
      }

      const presetOptions = {
        extension: '.m4a',
        sampleRate: 16000,
        numberOfChannels: 1, // Mono channel: required for reliable Android microphone capture
        bitRate: 64000,
        android: {
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
          audioSource: 'mic',
        },
        ios: {
          outputFormat: 'aac ',
          audioQuality: 96,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      const RecorderConstructor = ExpoAudio.AudioModule?.AudioRecorder || ExpoAudio.AudioRecorder;
      if (RecorderConstructor) {
        const recorder = new RecorderConstructor(presetOptions);
        await recorder.prepareToRecordAsync(presetOptions);
        recorder.record();
        activeExpoAudioRecorder = recorder;
        console.log('[Voice Recording] Native expo-audio recording started (Mono 16kHz, source=mic) at:', new Date().toISOString());
        return;
      }
    } catch (err) {
      console.warn('[Voice Recording] expo-audio start error, attempting expo-av fallback:', err);
    }
  }

  // Fallback: expo-av
  if (ExpoAV && ExpoAV.Audio) {
    try {
      await ExpoAV.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentLockedModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const recording = new ExpoAV.Audio.Recording();
      const options = ExpoAV.Audio.RecordingOptionsPresets?.HIGH_QUALITY || ExpoAV.Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY;
      await recording.prepareToRecordAsync(options);
      await recording.startAsync();
      activeExpoAvRecording = recording;
      console.log('[Voice Recording] Native expo-av recording started at:', new Date().toISOString());
      return;
    } catch (err) {
      console.error('[Voice Recording] expo-av start error:', err);
    }
  }

  activeRecordingState = 'ERROR';
  throw new Error('No supported native audio recorder found on this device.');
}

/**
 * Stop microphone recording and return the recorded metadata, URI (Native), or Blob (Web).
 */
export async function stopRealAudioRecording(): Promise<RecordedAudioResult | null> {
  const durationMs = Date.now() - recordingStartTime;
  console.log('[Voice Recording] Stop triggered. Duration elapsed:', durationMs, 'ms');

  if (activeSpeechRecognition) {
    try {
      activeSpeechRecognition.stop();
    } catch (e) {}
    activeSpeechRecognition = null;
  }

  if (activeRecordingState !== 'RECORDING') {
    console.warn('[Voice Recording] stopRealAudioRecording called but state is:', activeRecordingState);
    return null;
  }

  activeRecordingState = 'PROCESSING';

  if (Platform.OS === 'web') {
    if (webMediaRecorder && webMediaRecorder.state !== 'inactive') {
      return new Promise((resolve) => {
        webMediaRecorder.onstop = () => {
          const audioBlob = new Blob(webAudioChunks, { type: 'audio/webm' });
          if (webMediaRecorder.stream) {
            webMediaRecorder.stream.getTracks().forEach((track: any) => track.stop());
          }
          webMediaRecorder = null;
          webAudioChunks = [];
          activeRecordingState = 'TRANSCRIBED';
          console.log('[Voice Recording] Web audio stopped. Blob size:', audioBlob.size, 'bytes, duration:', durationMs, 'ms');
          resolve({
            blob: audioBlob,
            durationMs,
            fileSizeBytes: audioBlob.size,
            mimeType: 'audio/webm',
            filename: 'recording.webm',
          });
        };
        webMediaRecorder.stop();
      });
    }
    activeRecordingState = 'IDLE';
    return null;
  }

  // Native: expo-audio
  if (activeExpoAudioRecorder) {
    try {
      const recorder = activeExpoAudioRecorder;
      await recorder.stop();
      const uri = recorder.uri || recorder.getURI?.();
      activeExpoAudioRecorder = null;

      console.log('[Voice Recording] Native expo-audio recording stopped. Output URI:', uri);

      if (!uri) {
        console.warn('[Voice Recording] Native recorder returned empty/null URI.');
        activeRecordingState = 'ERROR';
        return null;
      }

      activeRecordingState = 'TRANSCRIBED';
      return {
        uri,
        durationMs,
        mimeType: 'audio/x-m4a',
        filename: 'recording.m4a',
      };
    } catch (err) {
      console.error('[Voice Recording] Error stopping expo-audio recorder:', err);
      activeExpoAudioRecorder = null;
      activeRecordingState = 'ERROR';
      return null;
    }
  }

  // Native fallback: expo-av
  if (activeExpoAvRecording) {
    try {
      const recording = activeExpoAvRecording;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      activeExpoAvRecording = null;

      console.log('[Voice Recording] Native expo-av recording stopped. Output URI:', uri);

      if (!uri) {
        console.warn('[Voice Recording] Expo-av returned empty URI.');
        activeRecordingState = 'ERROR';
        return null;
      }

      activeRecordingState = 'TRANSCRIBED';
      return {
        uri,
        durationMs,
        mimeType: 'audio/x-m4a',
        filename: 'recording.m4a',
      };
    } catch (err) {
      console.error('[Voice Recording] Error stopping expo-av recording:', err);
      activeExpoAvRecording = null;
      activeRecordingState = 'ERROR';
      return null;
    }
  }

  activeRecordingState = 'IDLE';
  return null;
}

/**
 * Cancel active recording without saving.
 */
export async function cancelAudioRecording(): Promise<void> {
  activeRecordingState = 'IDLE';
  try {
    if (Platform.OS === 'web') {
      if (webMediaRecorder && webMediaRecorder.state !== 'inactive') {
        if (webMediaRecorder.stream) {
          webMediaRecorder.stream.getTracks().forEach((track: any) => track.stop());
        }
        webMediaRecorder = null;
        webAudioChunks = [];
      }
    } else if (activeExpoAudioRecorder) {
      await activeExpoAudioRecorder.stop();
      activeExpoAudioRecorder = null;
    } else if (activeExpoAvRecording) {
      await activeExpoAvRecording.stopAndUnloadAsync();
      activeExpoAvRecording = null;
    }
  } catch (err) {
    console.warn('[Voice Recording] Error cancelling recording:', err);
  }
}

const EMERGENCY_BEEP_WAV_BASE64 = 'data:audio/wav;base64,UklGRgQMAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YeALAAAN8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N8/Pz8w0NDQ3z8/PzDQ0NDfPz8/MNDQ3z8/PzDQ0NDfPz8/MNDQ0N8/PzDQ0NDfPz8/MNDQ0N8/Pz8w0NDfPz8/MNDQ0N8/Pz8w0NDQ3z8/MNDQ0N8/Pz8w0NDQ3z8/PzDQ0N';

/**
 * Play a high-decibel emergency siren buzzer tone (BEEP! BEEP! BEEP!) using Web Audio API synthesis and Base64 Audio.
 */
export function playEmergencyBuzzerSound(): void {
  try {
    // 1. Play HTML5 Audio Base64 WAV Beep File
    if (typeof window !== 'undefined' && 'Audio' in window) {
      try {
        const audio = new Audio(EMERGENCY_BEEP_WAV_BASE64);
        audio.volume = 1.0;
        audio.play().catch(e => console.warn('HTML5 Beep playback:', e));
      } catch (e) {}
    }

    // 2. Synthesize additional piercing siren frequency backup via Web Audio API
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;

        [0, 0.20, 0.40, 0.60].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(idx % 2 === 0 ? 1050 : 1350, now + offset);

          gain.gain.setValueAtTime(0.7, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + 0.17);
        });
      }
    }
  } catch (err) {
    console.warn('Emergency buzzer sound error:', err);
  }
}
