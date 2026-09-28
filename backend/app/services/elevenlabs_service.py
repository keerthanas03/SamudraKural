import base64
import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class ElevenLabsService:
    """
    ElevenLabs Voice Service (Multilingual v2 Text-to-Speech and Speech-to-Text).
    Provides natural pauses and high quality multilingual playback for Indian coastal languages.
    """

    def __init__(self):
        self.api_url = "https://api.elevenlabs.io/v1"

    @property
    def api_key(self) -> str:
        return (getattr(settings, "ELEVENLABS_API_KEY", None) or "").strip()

    @property
    def voice_id(self) -> str:
        return (getattr(settings, "ELEVENLABS_VOICE_ID", None) or "21m00Tcm4TlvDq8ikWAM").strip()

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def text_to_speech(
        self,
        text: str,
        language_code: str = "ta",
        voice_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes speech using ElevenLabs Multilingual v2.
        Returns base64 encoded MP3 audio bytes.
        """
        if not self.is_available():
            return {
                "status": "error",
                "message": "ElevenLabs API key is not configured.",
                "audio_base64": None
            }

        target_voice = voice_id or self.voice_id
        url = f"{self.api_url}/text-to-speech/{target_voice}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.80,
                "style": 0.15,
                "use_speaker_boost": True
            }
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    audio_b64 = base64.b64encode(resp.content).decode("utf-8")
                    return {
                        "status": "success",
                        "audio_base64": audio_b64,
                        "format": "mp3",
                        "language": language_code
                    }
                else:
                    logger.warning(f"ElevenLabs TTS failed with HTTP {resp.status_code}: {resp.text}")
                    return {
                        "status": "error",
                        "message": f"ElevenLabs TTS error ({resp.status_code}): {resp.text}",
                        "audio_base64": None
                    }
        except Exception as e:
            logger.warning(f"ElevenLabs TTS request exception: {e}")
            return {
                "status": "error",
                "message": str(e),
                "audio_base64": None
            }

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        filename: str = "audio.m4a",
        language_code: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Transcribes speech using ElevenLabs Scribe STT.
        """
        if not self.is_available():
            openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
            if openai_key:
                return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
            return {
                "status": "error",
                "message": "ElevenLabs API key is not configured.",
                "transcript": ""
            }

        url = f"{self.api_url}/speech-to-text"
        headers = {"xi-api-key": self.api_key}
        data = {"model_id": "scribe_v1"}

        # Normalize language code for ElevenLabs (supports 2-letter or 3-letter ISO codes: 'ta'/'tam', 'te'/'tel', etc.)
        if language_code and language_code != "unknown":
            raw_lang = language_code.split("-")[0].strip().lower()
            lang_map = {
                "tamil": "tam", "ta": "ta",
                "telugu": "tel", "te": "te",
                "malayalam": "mal", "ml": "ml",
                "kannada": "kan", "kn": "kn",
                "hindi": "hin", "hi": "hi",
                "marathi": "mar", "mr": "mr",
                "gujarati": "guj", "gu": "gu",
                "bengali": "ben", "bn": "bn",
                "odia": "ori", "or": "or", "od": "or",
                "english": "eng", "en": "en",
            }
            mapped_lang = lang_map.get(raw_lang, raw_lang)
            if mapped_lang:
                data["language_code"] = mapped_lang

        # Determine MIME type
        mime_type = "audio/mp4"
        if filename.endswith(".wav"):
            mime_type = "audio/wav"
        elif filename.endswith(".webm"):
            mime_type = "audio/webm"
        elif filename.endswith(".mp3"):
            mime_type = "audio/mpeg"
        elif filename.endswith(".m4a") or filename.endswith(".aac") or filename.endswith(".mp4"):
            mime_type = "audio/mp4"

        files = {"file": (filename, audio_bytes, mime_type)}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=headers, data=data, files=files)
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_transcript = res_json.get("text", "").strip()
                    detected_lang = res_json.get("language_code", language_code)

                    # Filter out non-speech event tags like [tone], [beep], [laughter], [applause], [screaming]
                    import re
                    clean_transcript = re.sub(r'\[.*?\]', '', raw_transcript).strip()

                    def normalize_2letter(c: str) -> str:
                        if not c:
                            return "ta"
                        cl = c.strip().lower()
                        rev_map = {
                            "tam": "ta", "tamil": "ta", "ta": "ta", "ta-in": "ta",
                            "eng": "en", "english": "en", "en": "en", "en-in": "en", "en-us": "en",
                            "tel": "te", "telugu": "te", "te": "te", "te-in": "te",
                            "mal": "ml", "malayalam": "ml", "ml": "ml", "ml-in": "ml",
                            "hin": "hi", "hindi": "hi", "hi": "hi", "hi-in": "hi",
                            "kan": "kn", "kannada": "kn", "kn": "kn", "kn-in": "kn",
                            "mar": "mr", "marathi": "mr", "mr": "mr", "mr-in": "mr",
                            "guj": "gu", "gujarati": "gu", "gu": "gu", "gu-in": "gu",
                            "ori": "or", "odia": "or", "or": "or", "od": "or", "or-in": "or",
                            "ben": "bn", "bengali": "bn", "bn": "bn", "bn-in": "bn",
                        }
                        return rev_map.get(cl, cl[:2] if len(cl) >= 2 else "ta")

                    # If clean transcript is empty and a language was specified, retry in auto-detect mode
                    if not clean_transcript and "language_code" in data:
                        retry_data = {"model_id": "scribe_v1"}
                        retry_resp = await client.post(url, headers=headers, data=retry_data, files=files)
                        if retry_resp.status_code == 200:
                            retry_json = retry_resp.json()
                            retry_raw = retry_json.get("text", "").strip()
                            retry_clean = re.sub(r'\[.*?\]', '', retry_raw).strip()
                            if retry_clean:
                                retry_lang = retry_json.get("language_code", detected_lang)
                                return {
                                    "status": "success",
                                    "transcript": retry_clean,
                                    "language": normalize_2letter(retry_lang)
                                }

                    if clean_transcript:
                        return {
                            "status": "success",
                            "transcript": clean_transcript,
                            "language": normalize_2letter(detected_lang)
                        }
                    else:
                        return {
                            "status": "error",
                            "message": "No clear speech detected. Please speak closer to the microphone and try again.",
                            "transcript": ""
                        }
                else:
                    logger.warning(f"ElevenLabs STT error ({resp.status_code}): {resp.text}")
                    openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
                    if openai_key:
                        return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
                    return {
                        "status": "error",
                        "message": f"ElevenLabs STT ({resp.status_code}): {resp.text}",
                        "transcript": ""
                    }
        except Exception as e:
            logger.warning(f"ElevenLabs STT exception: {e}")
            openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
            if openai_key:
                return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
            return {"status": "error", "message": str(e), "transcript": ""}

    async def _whisper_stt(
        self,
        audio_bytes: bytes,
        filename: str,
        openai_key: str,
        language_code: str
    ) -> Dict[str, Any]:
        try:
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            data = {"model": "whisper-1"}
            if language_code and language_code != "unknown":
                data["language"] = language_code
            files = {"file": (filename, audio_bytes, "audio/m4a")}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, data=data, files=files)
                if resp.status_code == 200:
                    res_json = resp.json()
                    return {
                        "status": "success",
                        "transcript": res_json.get("text", "").strip(),
                        "language": language_code
                    }
        except Exception as e:
            logger.warning(f"OpenAI Whisper fallback exception: {e}")
        return {"status": "error", "message": "STT recognition unavailable", "transcript": ""}

elevenlabs_service = ElevenLabsService()
