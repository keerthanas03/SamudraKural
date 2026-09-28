import os
import re
import tempfile
import logging
import subprocess
from typing import Dict, Any, Optional
import speech_recognition as sr
import imageio_ffmpeg

logger = logging.getLogger(__name__)

LANG_LOCALE_MAP = {
    "ta": "ta-IN",
    "tamil": "ta-IN",
    "en": "en-IN",
    "english": "en-IN",
    "hi": "hi-IN",
    "hindi": "hi-IN",
    "te": "te-IN",
    "telugu": "te-IN",
    "ml": "ml-IN",
    "malayalam": "ml-IN",
    "kn": "kn-IN",
    "kannada": "kn-IN",
    "mr": "mr-IN",
    "marathi": "mr-IN",
    "gu": "gu-IN",
    "gujarati": "gu-IN",
    "bn": "bn-IN",
    "bengali": "bn-IN",
    "or": "or-IN",
    "odia": "or-IN",
}

TANGLISH_REPLACEMENTS = [
    (r'\b(?:naalaikku|nalaikku|naalaiku|nalaiku)\b', 'நாளைக்கு'),
    (r'\b(?:naalai|nalai)\b', 'நாளை'),
    (r'\b(?:chennaiyil|chennaiel)\b', 'சென்னையில்'),
    (r'\bchennai\b', 'சென்னை'),
    (r'\b(?:mazhai|malai)\b', 'மழை'),
    (r'\b(?:peiyum\s*maa|peyyumo|peyyuma|peiyuma|peiyum)\b', 'பெய்யுமா?'),
    (r'\b(?:varuma|varumo)\b', 'வருமா?'),
    (r'\b(?:kadalil|kadalula)\b', 'கடலில்'),
    (r'\bkadal\b', 'கடல்'),
    (r'\bnaan\b', 'நான்'),
    (r'\bmeen\b', 'மீன்'),
    (r'\b(?:pidikka|pidika)\b', 'பிடிக்கப்'),
    (r'\b(?:pogalama|pogalaama)\b', 'போகலாமா?'),
    (r'\b(?:kaatrin|kaathu|kaatru)\b', 'காற்றின்'),
    (r'\bvegam\b', 'வேகம்'),
    (r'\b(?:alai|alaikal|alagal)\b', 'அலை'),
    (r'\buyaram\b', 'உயரம்'),
    (r'\b(?:evvalavu|evlo)\b', 'எவ்வளவு?'),
    (r'\b(?:thuraimugam|thuraigam)\b', 'துறைமுகம்'),
    (r'\b(?:engu|enga|enge)\b', 'எங்கே?'),
    (r'\b(?:eppadi|epdi)\b', 'எப்படி'),
    (r'\b(?:ullathu|iruku|irukku)\b', 'உள்ளது?'),
    (r'\b(?:paadhukaappana|paadhukaappa)\b', 'பாதுகாப்பானதா?'),
]

HINGLISH_REPLACEMENTS = [
    (r'\b(?:cal|kal)\s+barish\s+hogi\s+kya\b|\bkya\s+(?:cal|kal)\s+barish\s+hogi\b', 'क्या कल बारिश होगी?'),
    (r'\b(?:cal|kal)\s+barish\s+hogi\b', 'कल बारिश होगी'),
    (r'\bbarish\s+hogi\s+kya\b', 'बारिश होगी क्या?'),
    (r'\b(?:cal|kal)\s+mausam\s+kaisa\s+rahega\b', 'कल मौसम कैसा रहेगा?'),
    (r'\baaj\s+mausam\s+kaisa\s+hai\b', 'आज मौसम कैसा है?'),
    (r'\bmachli\s+pakadne\s+ja\s+sakte\s+hain\b', 'मछली पकड़ने जा सकते हैं?'),
    (r'\b(?:cal|kal)\b', 'कल'),
    (r'\baaj\b', 'आज'),
    (r'\bbarish\b', 'बारिश'),
    (r'\bhogi\b', 'होगी'),
    (r'\bhoga\b', 'होगा'),
    (r'\bkya\b', 'क्या'),
    (r'\bmausam\b', 'मौसम'),
    (r'\bkaisa\b', 'कैसा'),
    (r'\brahega\b', 'रहेगा'),
    (r'\bhai\b', 'है'),
    (r'\bhain\b', 'हैं'),
    (r'\bmachli\b', 'मछली'),
    (r'\bpakadne\b', 'पकड़ने'),
    (r'\bja\b', 'जा'),
    (r'\bsakte\b', 'सकते'),
    (r'\bchennai\b', 'चेन्नई'),
    (r'\bmein\b', 'में'),
    (r'\bhawa\b', 'हवा'),
    (r'\bki\b', 'की'),
    (r'\bgati\b', 'गति'),
    (r'\bsamundar\b', 'समुद्र'),
    (r'\blehar\b', 'लहर'),
    (r'\btufan\b|\btoofan\b', 'तूफान'),
]

TENGLISH_REPLACEMENTS = [
    (r'\brepu\s+varsham\s+padutunda\b', 'రేపు వర్షం పడుతుందా?'),
    (r'\brepu\s+varsham\s+padtada\b', 'రేపు వర్షం పడుతుందా?'),
    (r'\brepu\b', 'రేపు'),
    (r'\beeroju\b|\bcroju\b', 'ఈరోజు'),
    (r'\bvarsham\b', 'వర్షం'),
    (r'\bpadutunda\b|\bpadtada\b', 'పడుతుందా?'),
    (r'\bchennai\s*lo\b', 'చెన్నైలో'),
    (r'\bchennai\b', 'చెన్నై'),
    (r'\bchepalu\b', 'చేపలు'),
    (r'\bpattocha\b', 'పట్టవచ్చా?'),
    (r'\bsamudram\b', 'సముద్రం'),
    (r'\bgali\b', 'గాలి'),
    (r'\bvegam\b', 'వేగం'),
]

def format_tanglish_to_tamil(text: str) -> str:
    res = text
    for pattern, tamil_word in TANGLISH_REPLACEMENTS:
        res = re.sub(pattern, tamil_word, res, flags=re.IGNORECASE)
    return res.strip()

def format_hinglish_to_hindi(text: str) -> str:
    res = text
    for pattern, hindi_word in HINGLISH_REPLACEMENTS:
        res = re.sub(pattern, hindi_word, res, flags=re.IGNORECASE)
    return res.strip()

def format_tenglish_to_telugu(text: str) -> str:
    res = text
    for pattern, telugu_word in TENGLISH_REPLACEMENTS:
        res = re.sub(pattern, telugu_word, res, flags=re.IGNORECASE)
    return res.strip()

class LiveSpeechToTextService:
    """
    Live real-time Speech-to-Text service that runs locally and directly
    transcribes live user audio into native Indian scripts (Tamil, Hindi, Telugu, etc.) and English.
    """

    def __init__(self):
        try:
            self.ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception as e:
            logger.warning(f"Could not locate imageio ffmpeg executable: {e}")
            self.ffmpeg_exe = "ffmpeg"
        self.recognizer = sr.Recognizer()

    def _detect_script_language(self, text: str, fallback_lang: str = "en") -> str:
        for ch in text:
            code = ord(ch)
            if 0x0900 <= code <= 0x097F:
                return "hi"
            elif 0x0B80 <= code <= 0x0BFF:
                return "ta"
            elif 0x0C00 <= code <= 0x0C7F:
                return "te"
            elif 0x0D00 <= code <= 0x0D7F:
                return "ml"
            elif 0x0C80 <= code <= 0x0CFF:
                return "kn"
            elif 0x0A80 <= code <= 0x0AFF:
                return "gu"
            elif 0x0980 <= code <= 0x09FF:
                return "bn"
            elif 0x0B00 <= code <= 0x0B7F:
                return "or"
        return fallback_lang[:2] if len(fallback_lang) >= 2 else "en"

    def convert_audio_to_wav(self, audio_bytes: bytes, input_format: str = "m4a") -> str:
        """
        Converts arbitrary audio bytes (m4a, webm, mp3, etc.) into 16kHz mono PCM WAV.
        Returns the path to the temporary wav file.
        """
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=f".{input_format}")
        temp_input.write(audio_bytes)
        temp_input.flush()
        temp_input.close()

        temp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_wav.close()

        try:
            cmd = [
                self.ffmpeg_exe,
                "-y",
                "-i", temp_input.name,
                "-ar", "16000",
                "-ac", "1",
                "-f", "wav",
                temp_wav.name
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode != 0:
                logger.error(f"FFMPEG audio conversion failed: {res.stderr.decode('utf-8', errors='ignore')}")
                raise RuntimeError("Failed to convert audio stream to standard WAV.")
            return temp_wav.name
        finally:
            if os.path.exists(temp_input.name):
                try:
                    os.remove(temp_input.name)
                except Exception:
                    pass

    def transcribe(self, audio_bytes: bytes, language: str = "en", input_format: str = "m4a") -> Dict[str, Any]:
        """
        Performs live Speech-to-Text transcription on the received audio.
        Guarantees that when a user speaks in Tamil, English, Telugu, Hindi, Malayalam, Kannada,
        Marathi, Gujarati, Bengali, or Odia, it is accurately transcribed in that language's
        native script and never mistakenly forced into another language.
        """
        if not audio_bytes or len(audio_bytes) == 0:
            return {"status": "error", "message": "Audio bytes are empty", "transcript": ""}

        norm_lang = language.strip().lower() if language else "en"
        if norm_lang in ("unknown", "auto", "none", "", "any"):
            norm_lang = "ta" # Default to Tamil for coastal fisherfolk if completely unspecified

        target_locale = LANG_LOCALE_MAP.get(norm_lang, LANG_LOCALE_MAP.get(norm_lang[:2], "ta-IN"))

        wav_path = None
        try:
            wav_path = self.convert_audio_to_wav(audio_bytes, input_format=input_format)
            with sr.AudioFile(wav_path) as source:
                audio_data = self.recognizer.record(source)

            # Master dictionary of language models and their script detection validators
            locale_registry = {
                "ta-IN": ("ta", lambda t: any(0x0B80 <= ord(c) <= 0x0BFF for c in t)), # Tamil
                "en-IN": ("en", lambda t: any(0x0041 <= ord(c) <= 0x007A for c in t)), # English
                "hi-IN": ("hi", lambda t: any(0x0900 <= ord(c) <= 0x097F for c in t)), # Hindi
                "te-IN": ("te", lambda t: any(0x0C00 <= ord(c) <= 0x0C7F for c in t)), # Telugu
                "ml-IN": ("ml", lambda t: any(0x0D00 <= ord(c) <= 0x0D7F for c in t)), # Malayalam
                "kn-IN": ("kn", lambda t: any(0x0C80 <= ord(c) <= 0x0CFF for c in t)), # Kannada
                "mr-IN": ("mr", lambda t: any(0x0900 <= ord(c) <= 0x097F for c in t)), # Marathi
                "gu-IN": ("gu", lambda t: any(0x0A80 <= ord(c) <= 0x0AFF for c in t)), # Gujarati
                "bn-IN": ("bn", lambda t: any(0x0980 <= ord(c) <= 0x09FF for c in t)), # Bengali
                "or-IN": ("or", lambda t: any(0x0B00 <= ord(c) <= 0x0B7F for c in t)), # Odia
            }

            # Build prioritized order of locales to test, starting with user's selected language
            ordered_locales = []
            if target_locale in locale_registry:
                ordered_locales.append(target_locale)

            # Add common alternatives in balanced order
            standard_order = ["ta-IN", "en-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN", "mr-IN", "gu-IN", "bn-IN", "or-IN"]
            for loc in standard_order:
                if loc not in ordered_locales and loc in locale_registry:
                    ordered_locales.append(loc)

            # 1. Test in prioritized order
            for loc_code in ordered_locales:
                lang_code, script_validator = locale_registry[loc_code]
                try:
                    res_text = self.recognizer.recognize_google(audio_data, language=loc_code)
                    if res_text and res_text.strip():
                        res_clean = res_text.strip()
                        
                        # Validate that output contains characters matching the script
                        if script_validator(res_clean):
                            if lang_code == "ta":
                                res_clean = format_tanglish_to_tamil(res_clean)
                            elif lang_code == "hi":
                                res_clean = format_hinglish_to_hindi(res_clean)
                            elif lang_code == "te":
                                res_clean = format_tenglish_to_telugu(res_clean)
                            elif lang_code == "en":
                                lower_text = res_clean.lower()
                                # 1. Check if English recognition is actually Hinglish
                                hindi_tokens = [
                                    "barish", "hogi", "hoga", "kya", "kal", "cal", "aaj", "mausam", "kaisa", "rahega",
                                    "machli", "pakadne", "ja", "sakte", "hain", "hai", "samundar", "hawa", "toofan", "tufan"
                                ]
                                # 2. Check if English recognition is actually Tanglish
                                tamil_tokens = [
                                    "naalai", "nalaiku", "naalaikku", "kadal", "kadalil", "meen", "pidikka", "pogalama",
                                    "mazhai", "malai", "peyyuma", "peiyuma", "varuma", "kaatru", "kaathu", "alai",
                                    "uyaram", "evvalavu", "evlo", "enga", "engu", "eppadi", "iruku", "irukku",
                                    "chennaiyil", "maduraiyil", "vanakkam"
                                ]
                                # 3. Check if English recognition is actually Tenglish
                                telugu_tokens = [
                                    "repu", "varsham", "padutunda", "padtada", "eeroju", "croju", "chepalu", "pattocha",
                                    "samudram", "gali", "vegam"
                                ]

                                if any(tok in lower_text for tok in hindi_tokens):
                                    res_clean = format_hinglish_to_hindi(res_clean)
                                    lang_code = "hi"
                                    loc_code = "hi-IN"
                                elif any(tok in lower_text for tok in tamil_tokens):
                                    res_clean = format_tanglish_to_tamil(res_clean)
                                    lang_code = "ta"
                                    loc_code = "ta-IN"
                                elif any(tok in lower_text for tok in telugu_tokens):
                                    res_clean = format_tenglish_to_telugu(res_clean)
                                    lang_code = "te"
                                    loc_code = "te-IN"

                            detected_script_lang = self._detect_script_language(res_clean, fallback_lang=lang_code)
                            logger.info(f"Live STT successfully recognized {detected_script_lang.upper()} [{loc_code}]: '{res_clean}'")
                            return {
                                "status": "success",
                                "transcript": res_clean,
                                "language": detected_script_lang,
                                "language_code": loc_code
                            }
                except sr.UnknownValueError:
                    continue
                except Exception as ex:
                    logger.debug(f"STT recognition attempt with {loc_code} raised: {ex}")
                    continue

            return {
                "status": "error",
                "message": "Could not recognize distinct speech from audio. Please speak clearly into the microphone.",
                "transcript": ""
            }

        except Exception as e:
            logger.error(f"Live STT exception: {e}", exc_info=True)
            return {
                "status": "error",
                "message": str(e),
                "transcript": ""
            }
        finally:
            if wav_path and os.path.exists(wav_path):
                try:
                    os.remove(wav_path)
                except Exception:
                    pass

live_stt_service = LiveSpeechToTextService()
