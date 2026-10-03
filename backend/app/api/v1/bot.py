import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel

from app.services.orca_agent_orchestrator import orca_orchestrator, OrcaChatResponse
from app.services.sarvam_service import sarvam_service
from app.services.elevenlabs_service import elevenlabs_service
from app.services.live_stt_service import live_stt_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bot", tags=["ask-bot"])

class BotQueryRequest(BaseModel):
    query: str
    latitude: Optional[float] = 13.0827
    longitude: Optional[float] = 80.3800
    vessel_type: Optional[str] = "Trawler"
    language: Optional[str] = "en"

class VoiceTTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

@router.post("/chat", response_model=OrcaChatResponse)
async def ask_bot_chat(payload: BotQueryRequest):
    """
    ORCA 12-Agent Chat & Voice Query Endpoint.
    Integrates 12 AI specialized marine agents with real-time satellite, weather, and ocean data.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    try:
        norm_lang = orca_orchestrator._normalize_lang_code(payload.language or "en") or "en"
        response = await orca_orchestrator.process_query(
            query=payload.query.strip(),
            lat=payload.latitude or 13.0827,
            lon=payload.longitude or 80.3800,
            vessel_type=payload.vessel_type or "Trawler",
            language=norm_lang
        )
        return response
    except Exception as e:
        logger.error(f"Error processing ORCA bot query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process AI marine request: {str(e)}")

import base64

class VoiceSTTBase64Request(BaseModel):
    audio_base64: str
    format: Optional[str] = "m4a"
    language: Optional[str] = "unknown"

@router.post("/voice-stt-base64")
@router.post("/transcribe-base64")
async def voice_speech_to_text_base64(payload: VoiceSTTBase64Request):
    """
    Multilingual Voice Speech-to-Text via JSON Base64 payload (Sarvam / ElevenLabs / Whisper).
    Avoids native Android/iOS multipart FormData bugs completely.
    """
    try:
        raw_b64 = payload.audio_base64
        if not raw_b64:
            return {"success": False, "status": "error", "message": "Audio base64 is empty", "transcript": ""}
        
        # Strip data URL prefix if present
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        
        audio_bytes = base64.b64decode(raw_b64)
        if len(audio_bytes) == 0:
            return {"success": False, "status": "error", "message": "Decoded audio is empty", "transcript": ""}

        filename = f"audio.{payload.format or 'm4a'}"
        req_lang = orca_orchestrator._normalize_lang_code(payload.language) or payload.language or "unknown"

        # 1. Primary STT: Sarvam AI Saaras STT (Automatic Multilingual Language Identification & Transcription)
        if sarvam_service.api_key:
            res = await sarvam_service.speech_to_text(
                audio_bytes,
                filename=filename,
                language_code="unknown"
            )
            if res.get("status") == "success" and res.get("transcript"):
                transcript = res["transcript"].strip()
                # Determine language strictly from transcript Unicode script and detected code
                detected_lang = orca_orchestrator._detect_query_language(transcript, res.get("language") or "en")
                logger.info(f"Sarvam STT successfully recognized [{detected_lang.upper()}]: '{transcript}'")
                return {
                    "success": True,
                    "status": "success",
                    "transcript": transcript,
                    "language": detected_lang,
                    "language_code": f"{detected_lang}-IN",
                    "source": "sarvam_ai"
                }

        # 2. Secondary STT: ElevenLabs Scribe STT
        if elevenlabs_service.is_available():
            el_res = await elevenlabs_service.speech_to_text(
                audio_bytes,
                filename=filename,
                language_code=req_lang
            )
            if el_res.get("status") == "success" and el_res.get("transcript"):
                transcript = el_res["transcript"].strip()
                detected_lang = orca_orchestrator._detect_query_language(transcript, el_res.get("language") or req_lang)
                logger.info(f"ElevenLabs STT recognized [{detected_lang.upper()}]: '{transcript}'")
                return {
                    "success": True,
                    "status": "success",
                    "transcript": transcript,
                    "language": detected_lang,
                    "language_code": f"{detected_lang}-IN",
                    "source": "elevenlabs"
                }

        # 3. Tertiary STT: Live Real-Time Speech Recognition Engine Fallback
        live_res = await asyncio.to_thread(
            live_stt_service.transcribe,
            audio_bytes,
            language=req_lang,
            input_format=payload.format or "m4a"
        )
        if live_res.get("status") == "success" and live_res.get("transcript"):
            transcript = live_res["transcript"].strip()
            detected_lang = orca_orchestrator._detect_query_language(transcript, live_res.get("language") or req_lang)
            logger.info(f"Live STT fallback recognized [{detected_lang.upper()}]: '{transcript}'")
            return {
                "success": True,
                "status": "success",
                "transcript": transcript,
                "language": detected_lang,
                "language_code": f"{detected_lang}-IN",
                "source": "live_engine"
            }

        # 4. If no speech could be identified across engines, return clear error
        det_lang = orca_orchestrator._normalize_lang_code(req_lang) or "ta"
        return {
            "success": False,
            "status": "error",
            "message": "Could not recognize distinct speech from audio. Please speak clearly into the microphone.",
            "transcript": "",
            "language": det_lang,
            "language_code": f"{det_lang}-IN"
        }
    except Exception as e:
        logger.error(f"Error in STT Base64 route: {e}")
        det_lang = orca_orchestrator._normalize_lang_code(payload.language if payload else "ta") or "ta"
        return {
            "success": False,
            "status": "error",
            "message": f"Speech-to-text error: {str(e)}",
            "transcript": "",
            "language": det_lang,
            "language_code": f"{det_lang}-IN"
        }

@router.post("/voice-stt")
@router.post("/transcribe")
async def voice_speech_to_text(
    file: UploadFile = File(...),
    language: str = Form("unknown")
):
    """
    Multilingual Voice Speech-to-Text Endpoint.
    """
    try:
        content = await file.read()
        if not content or len(content) == 0:
            return {"success": False, "status": "error", "message": "Uploaded audio file is empty", "transcript": ""}

        req_lang = orca_orchestrator._normalize_lang_code(language) or language or "en"
        ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "m4a"

        # 1. Primary: Live Real-Time Speech Recognizer
        live_res = await asyncio.to_thread(
            live_stt_service.transcribe,
            content,
            language=req_lang,
            input_format=ext
        )
        if live_res.get("status") == "success" and live_res.get("transcript"):
            det_lang = orca_orchestrator._normalize_lang_code(live_res.get("language") or req_lang) or "en"
            return {
                "success": True,
                "status": "success",
                "transcript": live_res.get("transcript", ""),
                "language": det_lang,
                "language_code": f"{det_lang}-IN"
            }
        
        # 2. Secondary: ElevenLabs STT
        if elevenlabs_service.is_available():
            el_res = await elevenlabs_service.speech_to_text(
                content,
                filename=file.filename or "audio.m4a",
                language_code=req_lang
            )
            if el_res.get("status") == "success" and el_res.get("transcript"):
                det_lang = orca_orchestrator._normalize_lang_code(el_res.get("language") or req_lang) or "en"
                return {
                    "success": True,
                    "status": "success",
                    "transcript": el_res.get("transcript", ""),
                    "language": det_lang,
                    "language_code": f"{det_lang}-IN"
                }

        # 3. Tertiary: Sarvam AI
        res = await sarvam_service.speech_to_text(
            content,
            filename=file.filename or "audio.m4a",
            language_code=req_lang
        )
        if res.get("status") == "success" and res.get("transcript"):
            det_lang = orca_orchestrator._normalize_lang_code(res.get("language")) or "en"
            return {
                "success": True,
                "status": "success",
                "transcript": res.get("transcript", ""),
                "language": det_lang,
                "language_code": f"{det_lang}-IN"
            }

        # 4. Fallback if no speech recognized
        det_lang = orca_orchestrator._normalize_lang_code(req_lang) or "ta"
        return {
            "success": False,
            "status": "error",
            "message": "Could not recognize distinct speech from audio. Please speak clearly.",
            "transcript": "",
            "language": det_lang,
            "language_code": f"{det_lang}-IN"
        }
    except Exception as e:
        logger.error(f"Error in STT route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-tts")
async def voice_text_to_speech(payload: VoiceTTSRequest):
    """
    Text-to-Speech Endpoint (Sarvam AI / ElevenLabs Multilingual v2).
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        # 1. Try Sarvam
        res = await sarvam_service.text_to_speech(payload.text.strip(), language_code=payload.language or "ta")
        if res.get("status") == "success":
            return res
        
        # 2. Try ElevenLabs
        if elevenlabs_service.is_available():
            el_res = await elevenlabs_service.text_to_speech(payload.text.strip(), language_code=payload.language or "ta")
            if el_res.get("status") == "success":
                return el_res

        return res
    except Exception as e:
        logger.error(f"Error in TTS route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quick-prompts")
def get_quick_prompts(language: str = Query("ta")):
    """Get localized quick action questions for fishermen across 10 Indian coastal languages"""
    prompts = {
        "ta": [
            "எனது இருப்பிடத்திலிருந்து நாளை நான் மீன்பிடிக்க போகலாமா?",
            "என்னைச் சுற்றியுள்ள சிறந்த மீன்பிடி மண்டலம் (PFZ) எங்கே?",
            "இங்கு நேரலை காற்றின் வேகம் மற்றும் அலை உயரம் எவ்வளவு?",
            "எனது தொலைந்த வலை எங்கே மிதந்து கொண்டிருக்கும்?",
            "இப்பகுதியில் புயல் அல்லது ஆபத்து எச்சரிக்கை உள்ளதா?"
        ],
        "te": [
            "నా స్థానం నుండి రేపు చేపల వేటకు వెళ్ళవచ్చా?",
            "నా సమీపంలో ఉన్న ఉత్తమ చేపల వేట ప్రాంతం ఎక్కడ ఉంది?",
            "ఇక్కడ గాలి వేగం మరియు అలల ఎత్తు ఎంత?",
            "నా పోయిన వల ఎక్కడ కొట్టుకుపోతోంది?",
            "ఈ ప్రాంతంలో తుఫాను లేదా ప్రమాద హెచ్చరిక ఉందా?"
        ],
        "ml": [
            "എന്റെ ലൊക്കേഷനിൽ നിന്ന് നാളെ മീൻപിടിക്കാൻ പോകാമോ?",
            "എനിക്ക് അടുത്തുള്ള മികച്ച മത്സ്യബന്ധന മേഖല എവിടെയാണ്?",
            "ഇവിടെ കാറ്റിന്റെ വേഗതയും തിരമാല ഉയരവും എത്രയാണ്?",
            "എന്റെ കാണാതായ വല എവിടെ ഒഴുകുന്നു?",
            "ഈ പ്രദേശത്ത് ചുഴലിക്കാറ്റ് അല്ലെങ്കിൽ സുരക്ഷാ മുന്നറിയിപ്പ് ഉണ്ടോ?"
        ],
        "hi": [
            "क्या मैं अपने स्थान से कल मछली पकड़ने जा सकता हूँ?",
            "मेरे निकटतम सर्वोत्तम मत्स्य क्षेत्र (PFZ) कहाँ है?",
            "यहाँ हवा की गति और लहरों की ऊँचाई कितनी है?",
            "मेरा खोया हुआ जाल कहाँ बह रहा है?",
            "क्या इस क्षेत्र में कोई तूफान या चक्रवात चेतावनी है?"
        ],
        "mr": [
            "माझ्या स्थानावरून मी उद्या मासेमारीसाठी जाऊ शकतो का?",
            "माझ्या जवळचे सर्वोत्तम मासेमारी क्षेत्र कुठे आहे?",
            "येथे वाऱ्याचा वेग आणि लाटांची उंची किती आहे?",
            "माझे हरवलेले जाळे कुठे वाहत आहे?",
            "या भागात काही वादळ किंवा धोक्याचा इशारा आहे का?"
        ],
        "gu": [
            "મારા સ્થાન પરથી શું હું આવતીકાલે માછીમારી માટે જઈ શકું?",
            "મારી નજીકનો શ્રેષ્ઠ માછીમારી વિસ્તાર ક્યાં છે?",
            "અહીં પવનની ગતિ અને મોજાની ઊંચાઈ કેટલી છે?",
            "મારી ખોવાયેલી જાળ ક્યાં તણાઈ રહી છે?",
            "આ વિસ્તારમાં કોઈ વાવાઝોડું કે ચેતવણી છે?"
        ],
        "or": [
            "ମୋ ସ୍ଥାନରୁ ଆସନ୍ତାକାଲି ମାଛ ଧରିବାକୁ ଯାଇପାରିବି କି?",
            "ମୋ ନିକଟତମ ସର୍ବୋତ୍ତମ ମତ୍ସ୍ୟ କ୍ଷେତ୍ର କେଉଁଠାରେ ଅଛି?",
            "ଏଠାରେ ପବନର ଗତି ଏବଂ ତରଙ୍ଗର ଉଚ୍ଚତା କେତେ?",
            "ମୋର ହଜିଯାଇଥିବା ଜାଲ କେଉଁଠାରେ ଭାସୁଛି?",
            "ଏହି ଅଞ୍ଚଳରେ କୌଣସି ଝଡ଼ କିମ୍ବା ବିପଦ ଚେତାବନୀ ଅଛି କି?"
        ],
        "kn": [
            "ನನ್ನ ಸ್ಥಳದಿಂದ ನಾನು ನಾಳೆ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ?",
            "ನನ್ನ ಹತ್ತಿರದ ಅತ್ಯುತ್ತಮ ಮೀನುಗಾರಿಕಾ ವಲಯ ಎಲ್ಲಿದೆ?",
            "ಇಲ್ಲಿ ಗಾಳಿಯ ವೇಗ ಮತ್ತು ಅಲೆಗಳ ಎತ್ತರ ಎಷ್ಟು?",
            "ನನ್ನ ಕಳೆದುಹೋದ ಬಲೆ ಎಲ್ಲಿ ತೇಲುತ್ತಿದೆ?",
            "ಈ ಪ್ರದೇಶದಲ್ಲಿ ಚಂಡಮಾರುತ ಅಥವಾ ಅಪಾಯದ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?"
        ],
        "bn": [
            "আমার বর্তমান অবস্থান থেকে আমি কি আগামীকাল মাছ ধরতে যেতে পারি?",
            "আমার কাছাকাছি সেরা মাছ ধরার অঞ্চল কোথায়?",
            "এখানে বাতাসের গতি এবং ঢেউয়ের উচ্চতা কত?",
            "আমার হারিয়ে যাওয়া জাল কোথায় ভাসছে?",
            "এই এলাকায় কোনো ঝড় বা বিপদের সতর্কতা আছে কি?"
        ],
        "en": [
            "Can I go fishing tomorrow from my current location?",
            "Where is the nearest best potential fishing zone (PFZ) around me?",
            "What is the live wind speed and wave height here?",
            "Where is my lost net drifting from my position?",
            "Is there any cyclone or high wave alert active in my area?"
        ]
    }
    return {"language": language, "prompts": prompts.get(language, prompts["en"])}
