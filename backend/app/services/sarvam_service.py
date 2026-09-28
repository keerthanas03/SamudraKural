import os
import logging
import httpx
import base64
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_LLM_URL = "https://api.sarvam.ai/v1/chat/completions"

SARVAM_LANG_MAP: Dict[str, str] = {
    "ta": "ta-IN",
    "te": "te-IN",
    "ml": "ml-IN",
    "hi": "hi-IN",
    "en": "en-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "or": "od-IN",
    "od": "od-IN",
    "kn": "kn-IN",
    "bn": "bn-IN",
}

SARVAM_SPEAKER_MAP: Dict[str, str] = {
    "ta": "kavya",
    "te": "kavya",
    "ml": "kavya",
    "hi": "kavya",
    "en": "kavya",
    "mr": "kavya",
    "gu": "kavya",
    "or": "kavya",
    "od": "kavya",
    "kn": "kavya",
    "bn": "kavya",
}

class SarvamAIService:
    """
    Sarvam AI Regional Language Voice & LLM Integration.
    Provides Speech-to-Text (saarika:v2), Text-to-Speech (bulbul:v3), and LLM text synthesis.
    """

    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        if self.api_key:
            logger.info("Sarvam AI Service initialized with valid API key.")
        else:
            logger.warning("SARVAM_API_KEY is missing in settings.")

    async def speech_to_text(
        self,
        file_bytes: bytes,
        filename: str = "audio.wav",
        language_code: str = "ta"
    ) -> Dict[str, Any]:
        """
        Transcribe audio voice recording to text using Sarvam AI Saaras API (saaras:v3).
        Supports WAV, MP3, M4A, AAC, and WEBM audio recordings.
        """
        if not self.api_key:
            return {"status": "error", "message": "Sarvam API key not configured", "transcript": ""}

        headers = {"api-subscription-key": self.api_key}
        
        # When language is unknown/auto or empty, allow Sarvam Saaras to auto-detect language
        if language_code in ("unknown", "auto", None, "", "any"):
            target_lang = "unknown"
        else:
            target_lang = SARVAM_LANG_MAP.get(language_code, "unknown")

        # Determine audio mime type from extension
        ext = filename.lower().split(".")[-1] if "." in filename else "m4a"
        mime_map = {
            "wav": "audio/wav",
            "m4a": "audio/x-m4a",
            "mp4": "audio/mp4",
            "mp3": "audio/mpeg",
            "webm": "audio/webm",
            "aac": "audio/aac",
            "ogg": "audio/ogg",
            "flac": "audio/flac",
            "3gp": "audio/amr"
        }
        content_type = mime_map.get(ext, "audio/x-m4a")

        try:
            async with httpx.AsyncClient(timeout=18.0) as client:
                files = {"file": (filename, file_bytes, content_type)}
                data = {
                    "language_code": target_lang,
                    "model": "saaras:v3",
                    "with_timestamps": "false"
                }
                res = await client.post(SARVAM_STT_URL, headers=headers, data=data, files=files)
                if res.status_code == 200:
                    result = res.json()
                    transcript = result.get("transcript", "").strip()
                    detected_code = result.get("language_code") or target_lang
                    
                    # Reverse map regional Sarvam code to 2-letter app code
                    lang_rev = {
                        "ta-IN": "ta",
                        "te-IN": "te",
                        "ml-IN": "ml",
                        "hi-IN": "hi",
                        "en-IN": "en",
                        "mr-IN": "mr",
                        "gu-IN": "gu",
                        "od-IN": "or",
                        "or-IN": "or",
                        "kn-IN": "kn",
                        "bn-IN": "bn",
                    }
                    detected_app_lang = lang_rev.get(detected_code, "en")

                    # If Tamil phonetic transliteration of Hindi occurs, correct to Devanagari
                    if any(ph in transcript for ph in ["பாரிஸ் ஹோகி", "ஹோகி கியா", "பாரிஸ் ஹோகா", "மச்லி பகட்"]):
                        import re
                        for pat, rep in [
                            (r'கல்\s+பாரிஸ்\s+ஹோகி\s+கியா|கியா\s+கல்\s+பாரிஸ்\s+ஹோகி', 'क्या कल बारिश होगी?'),
                            (r'பாரிஸ்\s+ஹோகி\s+கியா', 'बारिश होगी क्या?'),
                            (r'கல்\s+பாரிஸ்\s+ஹோகி', 'कल बारिश होगी'),
                            (r'பாரிஸ்\s+ஹோகா', 'बारिश होगा'),
                            (r'மச்லி\s+பகட்னே', 'मछली पकड़ने'),
                        ]:
                            transcript = re.sub(pat, rep, transcript)
                        detected_app_lang = "hi"
                        detected_code = "hi-IN"

                    from app.services.live_stt_service import (
                        format_hinglish_to_hindi,
                        format_tanglish_to_tamil,
                        format_tenglish_to_telugu
                    )
                    if detected_app_lang == "hi":
                        transcript = format_hinglish_to_hindi(transcript)
                    elif detected_app_lang == "ta":
                        transcript = format_tanglish_to_tamil(transcript)
                    elif detected_app_lang == "te":
                        transcript = format_tenglish_to_telugu(transcript)

                    logger.info(f"Sarvam STT success. Detected: {detected_code} -> {detected_app_lang}. Transcript: '{transcript}'")
                    return {
                        "status": "success",
                        "transcript": transcript,
                        "language_code": detected_code,
                        "language": detected_app_lang,
                        "raw": result
                    }
                else:
                    logger.error(f"Sarvam STT failed HTTP {res.status_code}: {res.text}")
                    return {
                        "status": "error",
                        "message": f"Sarvam STT failed ({res.status_code}): {res.text}",
                        "transcript": ""
                    }
        except Exception as e:
            logger.error(f"Error calling Sarvam STT API: {e}")
            return {"status": "error", "message": str(e), "transcript": ""}

    async def text_to_speech(
        self,
        text: str,
        language_code: str = "ta",
        speaker: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesize natural regional voice audio (.wav) from text using Sarvam AI Bulbul API.
        """
        if not self.api_key:
            return {"status": "error", "message": "Sarvam API key not configured"}

        # Clean markdown symbols from text before sending to TTS
        clean_text = (
            text.replace("**", "")
            .replace("*", "")
            .replace("#", "")
            .replace("•", "")
            .replace("`", "")
            .strip()
        )
        if not clean_text:
            return {"status": "error", "message": "Cleaned text is empty"}

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        target_lang = SARVAM_LANG_MAP.get(language_code, "ta-IN")
        target_speaker = speaker or SARVAM_SPEAKER_MAP.get(language_code, "kavya")

        payload = {
            "inputs": [clean_text[:480]],
            "target_language_code": target_lang,
            "speaker": target_speaker,
            "pitch": 0,
            "pace": 1.0,
            "loudness": 1.5,
            "speech_sample_rate": 22050,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }

        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                res = await client.post(SARVAM_TTS_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    result = res.json()
                    audios = result.get("audios", [])
                    audio_b64 = audios[0] if audios else ""
                    logger.info(f"Sarvam TTS success ({target_lang}). Audio generated: {len(audio_b64)} chars")
                    return {
                        "status": "success",
                        "audio_base64": audio_b64,
                        "language": target_lang,
                        "format": "wav"
                    }
                else:
                    logger.warning(f"Sarvam TTS failed HTTP {res.status_code}: {res.text}. Falling back to multi-lingual TTS engine.")
        except Exception as e:
            logger.warning(f"Error calling Sarvam TTS API: {e}. Falling back to multi-lingual TTS engine.")

        # Robust High-Fidelity Multi-lingual TTS Fallback
        try:
            tts_lang = language_code[:2] if len(language_code) >= 2 else "ta"
            if tts_lang == "od":
                tts_lang = "or"
            langs_to_try = [tts_lang]
            if tts_lang in ("or", "od"):
                langs_to_try.extend(["hi", "en"])
            
            import urllib.parse
            encoded_query = urllib.parse.quote(clean_text[:400])
            
            async with httpx.AsyncClient(timeout=6.0) as client:
                for lang_candidate in langs_to_try:
                    try:
                        g_url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_query}&tl={lang_candidate}&client=tw-ob"
                        g_res = await client.get(g_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                        if g_res.status_code == 200 and len(g_res.content) > 100:
                            audio_b64 = base64.b64encode(g_res.content).decode("utf-8")
                            logger.info(f"Multi-lingual TTS success ({lang_candidate}). Audio generated: {len(audio_b64)} chars")
                            return {
                                "status": "success",
                                "audio_base64": audio_b64,
                                "language": language_code,
                                "format": "mp3"
                            }
                    except Exception:
                        continue
        except Exception as ex:
            logger.error(f"Multi-lingual TTS fallback error: {ex}")

        return {"status": "error", "message": "TTS synthesis failed", "audio_base64": None}

    async def generate_regional_marine_summary(
        self,
        prompt: str,
        language_code: str = "ta",
        system_instruction: Optional[str] = None
    ) -> Optional[str]:
        """
        Use Google Gemini API (gemini-2.0-flash) or Sarvam-105B LLM to generate grounded,
        concise marine answers tailored for coastal fishermen.
        """
        lang_names = {
            "en": "English", "ta": "Tamil", "hi": "Hindi", "te": "Telugu",
            "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
            "bn": "Bengali", "or": "Odia"
        }
        target_lang_name = lang_names.get(language_code, language_code)
        default_system = (
            f"You are Samudra Kural AI, an expert marine and weather advisory system. "
            f"Give a short, clear, actionable response in 2 to 4 lines. "
            f"CRITICAL LANGUAGE RULE: Respond STRICTLY in {target_lang_name} ({language_code}). "
            f"If the user query is in English, you must respond strictly in English without using any other language. "
            f"If in Tamil, respond in Tamil script. If in Hindi, respond in Devanagari script. "
            f"Use ONLY the real measurements provided in the prompt. Never invent numbers or contradict safety ratings."
        )
        active_system = system_instruction or default_system

        # 1. Try Google Gemini API if GEMINI_API_KEY is present
        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if gemini_key:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
                payload = {
                    "system_instruction": {
                        "parts": [{"text": active_system}]
                    },
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 250
                    }
                }
                async with httpx.AsyncClient(timeout=6.0) as client:
                    res = await client.post(gemini_url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                text = parts[0]["text"].strip()
                                logger.info(f"Google Gemini 2.0 Flash LLM success: '{text[:80]}...'")
                                return text
            except Exception as e:
                logger.warning(f"Google Gemini LLM call bypassed: {e}")

        # 2. Try Sarvam LLM (sarvam-105b-conversations) if SARVAM_API_KEY is present
        if not self.api_key:
            return None

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "model": "sarvam-105b-conversations",
            "messages": [
                {
                    "role": "system",
                    "content": active_system
                },
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 250,
            "temperature": 0.2
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(SARVAM_LLM_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        content = choices[0]["message"].get("content", "")
                        logger.info(f"Sarvam LLM success: '{content[:80]}...'")
                        return content.strip()
        except Exception as e:
            logger.warning(f"Sarvam LLM call bypassed: {e}")

        return None

sarvam_service = SarvamAIService()
