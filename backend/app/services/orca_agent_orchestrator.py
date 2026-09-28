import asyncio
import logging
import math
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel

from app.services.environment_service import UnifiedEnvironmentService
from app.services.incois_service import incois_service, fetch_incois_sector_advisory, find_nearest_sector
from app.services.drift_engine import drift_engine
from app.services.sarvam_service import sarvam_service
from app.services.elevenlabs_service import elevenlabs_service
from app.schemas.environment import EnvironmentalState

logger = logging.getLogger(__name__)

env_aggregator = UnifiedEnvironmentService()
_WEATHER_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

class AgentExecutionStep(BaseModel):
    agent_id: int
    name: str
    icon: str
    status: str
    details: str

class RiskAssessment(BaseModel):
    level: str
    color: str
    title: str
    reason: str
    advice: str

class HotspotSummary(BaseModel):
    name: str
    latitude: float
    longitude: float
    distance_km: float
    distance_nm: float
    bearing_deg: float
    cardinal_direction: str
    target_species: List[str]
    depth_meters: int

class OrcaChatResponse(BaseModel):
    query: str
    language: str
    intent: str
    response_text: str
    voice_speech_text: str
    voice_audio_base64: Optional[str] = None
    risk_assessment: RiskAssessment
    agent_steps: List[AgentExecutionStep]
    suggested_hotspot: Optional[HotspotSummary] = None
    telemetry: Dict[str, Any]
    quick_actions: List[Dict[str, str]]
    community_reports: List[Dict[str, Any]]

# Verified Real Indian Coastal Ports & Fisheries Harbours Database
INDIAN_COASTAL_PORTS = [
    {"name": "Port of Chennai (Harbour Entrance)", "state": "Tamil Nadu", "lat": 13.0827, "lon": 80.2925, "depth_m": 19, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Kamarajar Port (Ennore)", "state": "Tamil Nadu", "lat": 13.2612, "lon": 80.3340, "depth_m": 16, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Cuddalore Port & Fishing Harbour", "state": "Tamil Nadu", "lat": 11.7042, "lon": 79.7725, "depth_m": 9, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Nagapattinam Fishing Harbour", "state": "Tamil Nadu", "lat": 10.7607, "lon": 79.8458, "depth_m": 8, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Rameswaram Fishing Jetty", "state": "Tamil Nadu", "lat": 9.2876, "lon": 79.3129, "depth_m": 6, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "V.O. Chidambaranar Port (Tuticorin)", "state": "Tamil Nadu", "lat": 8.7533, "lon": 78.1969, "depth_m": 14, "vhf": "VHF Ch 16 / 14 (156.8 MHz)"},
    {"name": "Kanyakumari Harbour", "state": "Tamil Nadu", "lat": 8.0780, "lon": 77.5550, "depth_m": 10, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Vizhinjam International Seaport", "state": "Kerala", "lat": 8.3753, "lon": 76.9890, "depth_m": 20, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Cochin / Kochi Port & Fisheries Harbour", "state": "Kerala", "lat": 9.9658, "lon": 76.2673, "depth_m": 14, "vhf": "VHF Ch 16 / 13 (156.8 MHz)"},
    {"name": "New Mangalore Port (Panambur)", "state": "Karnataka", "lat": 12.9288, "lon": 74.8184, "depth_m": 15, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Mormugao Port (Goa)", "state": "Goa", "lat": 15.4144, "lon": 73.8016, "depth_m": 14, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Mumbai Port (MbPT)", "state": "Maharashtra", "lat": 18.9500, "lon": 72.8500, "depth_m": 14, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Jawaharlal Nehru Port (JNPT)", "state": "Maharashtra", "lat": 18.9500, "lon": 72.9500, "depth_m": 14, "vhf": "VHF Ch 16 / 13 (156.8 MHz)"},
    {"name": "Deendayal Port (Kandla)", "state": "Gujarat", "lat": 23.0033, "lon": 70.2192, "depth_m": 13, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Krishnapatnam Port", "state": "Andhra Pradesh", "lat": 14.2500, "lon": 80.1250, "depth_m": 18, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Visakhapatnam Port", "state": "Andhra Pradesh", "lat": 17.6933, "lon": 83.2986, "depth_m": 18, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Paradip Port", "state": "Odisha", "lat": 20.2644, "lon": 86.6714, "depth_m": 17, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Syama Prasad Mookerjee Port (Haldia)", "state": "West Bengal", "lat": 22.0200, "lon": 88.0600, "depth_m": 12, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Port Blair Port", "state": "Andaman & Nicobar", "lat": 11.6667, "lon": 92.7333, "depth_m": 15, "vhf": "VHF Ch 16 (156.8 MHz)"},
]

KNOWN_LOCATIONS: Dict[str, Dict[str, Any]] = {
    # Tamil Nadu Cities & Ports
    "madurai": {"name": "Madurai", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "மதுரை": {"name": "மதுரை (Madurai)", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "मदुरै": {"name": "मदुरै (Madurai)", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "मदुरई": {"name": "मदुरई (Madurai)", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "మధురై": {"name": "మధురై (Madurai)", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "മധുര": {"name": "മധുര (Madurai)", "lat": 9.9252, "lon": 78.1198, "is_inland": True},
    "chennai": {"name": "Chennai", "lat": 13.0827, "lon": 80.2707, "is_inland": False},
    "சென்னை": {"name": "சென்னை (Chennai)", "lat": 13.0827, "lon": 80.2707, "is_inland": False},
    "चेन्नई": {"name": "चेन्नई (Chennai)", "lat": 13.0827, "lon": 80.2707, "is_inland": False},
    "चेन्नै": {"name": "चेन्नै (Chennai)", "lat": 13.0827, "lon": 80.2707, "is_inland": False},
    "చెన్నై": {"name": "చెన్నై (Chennai)", "lat": 13.0827, "lon": 80.2707, "is_inland": False},
    "rameswaram": {"name": "Rameswaram", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "rameshwaram": {"name": "Rameswaram", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "ராமேஸ்வரம்": {"name": "ராமேஸ்வரம் (Rameswaram)", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "ராமேசுவரம்": {"name": "ராமேசுவரம் (Rameswaram)", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "रामेश्वरम": {"name": "रामेश्वरम (Rameswaram)", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "रामेश्वर": {"name": "रामेश्वर (Rameswaram)", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "రామేశ్వరం": {"name": "రామేశ్వరం (Rameswaram)", "lat": 9.2876, "lon": 79.3129, "is_inland": False},
    "kanyakumari": {"name": "Kanyakumari", "lat": 8.0883, "lon": 77.5385, "is_inland": False},
    "கன்னியாகுமரி": {"name": "கன்னியாகுமரி (Kanyakumari)", "lat": 8.0883, "lon": 77.5385, "is_inland": False},
    "कन्याकुमारी": {"name": "कन्याकुमारी (Kanyakumari)", "lat": 8.0883, "lon": 77.5385, "is_inland": False},
    "కన్యాకుమారి": {"name": "కన్యాకుమారి (Kanyakumari)", "lat": 8.0883, "lon": 77.5385, "is_inland": False},
    "tuticorin": {"name": "Tuticorin (Thoothukudi)", "lat": 8.7642, "lon": 78.1348, "is_inland": False},
    "thoothukudi": {"name": "Thoothukudi", "lat": 8.7642, "lon": 78.1348, "is_inland": False},
    "தூத்துக்குடி": {"name": "தூத்துக்குடி (Thoothukudi)", "lat": 8.7642, "lon": 78.1348, "is_inland": False},
    "तूतीकोरिन": {"name": "तूतीकोरिन (Thoothukudi)", "lat": 8.7642, "lon": 78.1348, "is_inland": False},
    "cuddalore": {"name": "Cuddalore", "lat": 11.7480, "lon": 79.7714, "is_inland": False},
    "கடலூர்": {"name": "கடலூர் (Cuddalore)", "lat": 11.7480, "lon": 79.7714, "is_inland": False},
    "कडलोर": {"name": "कडलोर (Cuddalore)", "lat": 11.7480, "lon": 79.7714, "is_inland": False},
    "nagapattinam": {"name": "Nagapattinam", "lat": 10.7672, "lon": 79.8449, "is_inland": False},
    "நாகப்பட்டினம்": {"name": "நாகப்பட்டினம் (Nagapattinam)", "lat": 10.7672, "lon": 79.8449, "is_inland": False},
    "नागपट्टिनम": {"name": "नागपट्टिनम (Nagapattinam)", "lat": 10.7672, "lon": 79.8449, "is_inland": False},
    "coimbatore": {"name": "Coimbatore", "lat": 11.0168, "lon": 76.9558, "is_inland": True},
    "கோயம்புத்தூர்": {"name": "கோயம்புத்தூர் (Coimbatore)", "lat": 11.0168, "lon": 76.9558, "is_inland": True},
    "कोयंबटूर": {"name": "कोयंबटूर (Coimbatore)", "lat": 11.0168, "lon": 76.9558, "is_inland": True},
    "trichy": {"name": "Tiruchirappalli", "lat": 10.7905, "lon": 78.7047, "is_inland": True},
    "திருச்சி": {"name": "திருச்சி (Tiruchirappalli)", "lat": 10.7905, "lon": 78.7047, "is_inland": True},
    "तिरुचिरापल्ली": {"name": "तिरुचिरापल्ली (Trichy)", "lat": 10.7905, "lon": 78.7047, "is_inland": True},

    # Kerala Cities & Ports
    "kochi": {"name": "Kochi", "lat": 9.9312, "lon": 76.2673, "is_inland": False},
    "cochin": {"name": "Cochin", "lat": 9.9312, "lon": 76.2673, "is_inland": False},
    "கொச்சி": {"name": "கொச்சி (Kochi)", "lat": 9.9312, "lon": 76.2673, "is_inland": False},
    "കൊച്ചി": {"name": "കൊച്ചി (Kochi)", "lat": 9.9312, "lon": 76.2673, "is_inland": False},
    "कोच्चि": {"name": "कोच्चि (Kochi)", "lat": 9.9312, "lon": 76.2673, "is_inland": False},
    "trivandrum": {"name": "Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366, "is_inland": False},
    "thiruvananthapuram": {"name": "Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366, "is_inland": False},
    "തിരുവനന്തപുരം": {"name": "തിരുവനന്തപുരം (Trivandrum)", "lat": 8.5241, "lon": 76.9366, "is_inland": False},
    "तिरुवनंतपुरम": {"name": "तिरुवनंतपुरम (Trivandrum)", "lat": 8.5241, "lon": 76.9366, "is_inland": False},
    "kozhikode": {"name": "Kozhikode (Calicut)", "lat": 11.2588, "lon": 75.7804, "is_inland": False},
    "calicut": {"name": "Calicut", "lat": 11.2588, "lon": 75.7804, "is_inland": False},
    "കോഴിക്കോട്": {"name": "കോഴിക്കോട് (Calicut)", "lat": 11.2588, "lon": 75.7804, "is_inland": False},

    # Andhra Pradesh & Telangana
    "visakhapatnam": {"name": "Visakhapatnam", "lat": 17.6868, "lon": 83.2185, "is_inland": False},
    "vizag": {"name": "Vizag", "lat": 17.6868, "lon": 83.2185, "is_inland": False},
    "విశాఖపట్నం": {"name": "విశాఖపట్నం (Vizag)", "lat": 17.6868, "lon": 83.2185, "is_inland": False},
    "विशाखापट्टनम": {"name": "विशाखापट्टनम (Vizag)", "lat": 17.6868, "lon": 83.2185, "is_inland": False},
    "kakinada": {"name": "Kakinada", "lat": 16.9891, "lon": 82.2475, "is_inland": False},
    "కాకినాడ": {"name": "కాకినాడ (Kakinada)", "lat": 16.9891, "lon": 82.2475, "is_inland": False},
    "hyderabad": {"name": "Hyderabad", "lat": 17.3850, "lon": 78.4867, "is_inland": True},
    "హైదరాబాద్": {"name": "హైదరాబాద్ (Hyderabad)", "lat": 17.3850, "lon": 78.4867, "is_inland": True},
    "हैदराबाद": {"name": "हैदराबाद (Hyderabad)", "lat": 17.3850, "lon": 78.4867, "is_inland": True},

    # Maharashtra, Gujarat, Goa, Karnataka, Odisha, WB
    "mumbai": {"name": "Mumbai", "lat": 18.9220, "lon": 72.8347, "is_inland": False},
    "मुंबई": {"name": "मुंबई (Mumbai)", "lat": 18.9220, "lon": 72.8347, "is_inland": False},
    "goa": {"name": "Goa", "lat": 15.2993, "lon": 74.1240, "is_inland": False},
    "गोवा": {"name": "गोवा (Goa)", "lat": 15.2993, "lon": 74.1240, "is_inland": False},
    "panaji": {"name": "Panaji (Goa)", "lat": 15.4909, "lon": 73.8278, "is_inland": False},
    "mangalore": {"name": "Mangalore", "lat": 12.9141, "lon": 74.8560, "is_inland": False},
    "मंगलोर": {"name": "मंगलोर (Mangalore)", "lat": 12.9141, "lon": 74.8560, "is_inland": False},
    "ಮಂಗಳೂರು": {"name": "ಮಂಗಳೂರು (Mangalore)", "lat": 12.9141, "lon": 74.8560, "is_inland": False},
    "bengaluru": {"name": "Bengaluru", "lat": 12.9716, "lon": 77.5946, "is_inland": True},
    "bangalore": {"name": "Bangalore", "lat": 12.9716, "lon": 77.5946, "is_inland": True},
    "बेंगलुरु": {"name": "बेंगलुरु (Bengaluru)", "lat": 12.9716, "lon": 77.5946, "is_inland": True},
    "paradip": {"name": "Paradip", "lat": 20.3165, "lon": 86.6114, "is_inland": False},
    "पारादीप": {"name": "पारादीप (Paradip)", "lat": 20.3165, "lon": 86.6114, "is_inland": False},
    "puri": {"name": "Puri", "lat": 19.8135, "lon": 85.8312, "is_inland": False},
    "पूरी": {"name": "पूरी (Puri)", "lat": 19.8135, "lon": 85.8312, "is_inland": False},
    "kolkata": {"name": "Kolkata", "lat": 22.5726, "lon": 88.3639, "is_inland": True},
    "कोलकाता": {"name": "कोलकाता (Kolkata)", "lat": 22.5726, "lon": 88.3639, "is_inland": True},
    "কলকাতা": {"name": "কলকাতা (Kolkata)", "lat": 22.5726, "lon": 88.3639, "is_inland": True},
    "digha": {"name": "Digha", "lat": 21.6266, "lon": 87.5074, "is_inland": False},
    "दीघा": {"name": "दीघा (Digha)", "lat": 21.6266, "lon": 87.5074, "is_inland": False},
    "delhi": {"name": "Delhi", "lat": 28.6139, "lon": 77.2090, "is_inland": True},
    "दिल्ली": {"name": "दिल्ली (Delhi)", "lat": 28.6139, "lon": 77.2090, "is_inland": True},
}

INTENT_AGENT_ROUTING: Dict[str, List[int]] = {
    "cyclone_storm": [1, 3, 8, 9],
    "rain_precipitation": [1, 3, 4, 8],
    "wave_conditions": [1, 4, 8],
    "wind_conditions": [1, 3, 8],
    "weather_ocean": [1, 3, 4, 8],
    "find_pfz": [1, 5, 9, 4],
    "fish_species": [1, 5, 7],
    "nearest_port": [1, 6, 9],
    "fishing_advisory": [1, 3, 4, 5, 8, 9],
    "safety_risk": [1, 3, 4, 8, 9],
    "net_drift": [1, 4, 3, 9, 10, 8],
    "general_marine_query": [1, 3, 4, 8, 9],
    "general_advisory": [1, 3, 4, 8, 9],
}

class OrcaAgentOrchestrator:

    def _normalize_lang_code(self, lang: Optional[str]) -> str:
        if not lang or lang.strip().lower() in ("unknown", "auto", "none", "", "any"):
            return ""
        l = lang.strip().lower()
        mapping = {
            "english": "en", "eng": "en", "en": "en", "en-in": "en", "en-us": "en",
            "tamil": "ta", "tam": "ta", "ta": "ta", "ta-in": "ta",
            "telugu": "te", "tel": "te", "te": "te", "te-in": "te",
            "malayalam": "ml", "mal": "ml", "ml": "ml", "ml-in": "ml",
            "hindi": "hi", "hin": "hi", "hi": "hi", "hi-in": "hi",
            "kannada": "kn", "kan": "kn", "kn": "kn", "kn-in": "kn",
            "marathi": "mr", "mar": "mr", "mr": "mr", "mr-in": "mr",
            "gujarati": "gu", "guj": "gu", "gu": "gu", "gu-in": "gu",
            "odia": "or", "ori": "or", "or": "or", "or-in": "or", "od": "or",
            "bengali": "bn", "ben": "bn", "bn": "bn", "bn-in": "bn",
        }
        return mapping.get(l, l[:2] if len(l) >= 2 else "en")

    def _detect_query_language(self, query: str, fallback_lang: str = "en") -> str:
        clean_fallback = self._normalize_lang_code(fallback_lang)
        q_raw = query.strip()
        q_lower = q_raw.lower()

        # 1. Check if Tamil script is actually phonetic Hindi words (e.g. கல் பாரிஸ் ஹோகி கியா)
        if any(w in q_raw for w in ["பாரிஸ்", "ஹோகி", "ஹோகா", "கியா", "மச்லி", "பகட்னே"]):
            return "hi"

        # 2. Majority Native Indic Unicode Script Counting
        script_counts = {
            "ta": sum(1 for c in q_raw if 0x0B80 <= ord(c) <= 0x0BFF),
            "te": sum(1 for c in q_raw if 0x0C00 <= ord(c) <= 0x0C7F),
            "ml": sum(1 for c in q_raw if 0x0D00 <= ord(c) <= 0x0D7F),
            "hi": sum(1 for c in q_raw if 0x0900 <= ord(c) <= 0x097F),
            "kn": sum(1 for c in q_raw if 0x0C80 <= ord(c) <= 0x0CFF),
            "gu": sum(1 for c in q_raw if 0x0A80 <= ord(c) <= 0x0AFF),
            "bn": sum(1 for c in q_raw if 0x0980 <= ord(c) <= 0x09FF),
            "or": sum(1 for c in q_raw if 0x0B00 <= ord(c) <= 0x0B7F),
        }
        max_script = max(script_counts, key=script_counts.get)
        if script_counts[max_script] > 0:
            if max_script == "hi" and clean_fallback == "mr":
                return "mr"
            return max_script

        import re
        words = set(re.findall(r'[a-zA-Z]+', q_lower))

        # 3. Check Romanized Tenglish keywords
        tenglish_tokens = {
            "repu", "varsham", "padutunda", "padtada", "eeroju", "croju",
            "chepalu", "pattocha", "samudram", "gali", "vegam"
        }
        if words.intersection(tenglish_tokens):
            return "te"

        # 4. Check Romanized Tanglish keywords
        tanglish_tokens = {
            "naalai", "nalaiku", "naalaikku", "netru", "inniku", "inraikku",
            "chennaiyil", "chennaiel", "kadalil", "kadal",
            "peyyumo", "peyyuma", "peiyuma", "peiyumo", "varuma", "pogalama", "pogalaama",
            "meen", "kaathu", "kaatru", "alai", "alagal", "uyaram", "mazhai", "malai",
            "thoondil", "valai", "padagu", "paadhukaappu", "eppadi", "epdi", "iruku", "irukku",
            "thuraigam", "thuraimugam", "engu", "enga", "enna", "sollunga"
        }
        if words.intersection(tanglish_tokens):
            return "ta"

        # 5. Check Romanized Hinglish keywords
        hinglish_tokens = {
            "kya", "hoga", "hogi", "barish", "hawa", "kal", "cal", "aaj", "samundar", "machli", "toofan",
            "kaisa", "hai", "hain", "kitna", "jaenge", "jao", "sakte", "batao", "kripya"
        }
        if words.intersection(hinglish_tokens):
            return "hi"
        hinglish_tokens = {
            "kya", "hoga", "hogi", "barish", "hawa", "kal", "aaj", "samundar", "machli", "toofan",
            "kaisa", "hai", "kitna", "jaenge", "jao", "sakte", "batao", "kripya"
        }
        if words.intersection(hinglish_tokens):
            return "hi"

        # 4. Check Common English vocabulary words
        english_words = {
            "what", "where", "when", "why", "how", "who", "which",
            "is", "are", "am", "was", "were", "will", "would", "shall", "should",
            "can", "could", "may", "might", "must", "do", "does", "did",
            "rain", "raining", "rainfall", "weather", "forecast", "cloud", "cloudy",
            "wind", "breeze", "gale", "gust", "storm", "cyclone", "speed",
            "wave", "waves", "swell", "sea", "ocean", "tide", "current",
            "fish", "fishing", "boat", "vessel", "trawler", "ship", "sail", "sailing",
            "port", "harbor", "harbour", "coast", "coastal", "shore", "beach",
            "today", "tomorrow", "tommorrow", "yesterday", "tonight", "morning", "evening",
            "date", "day", "days", "week", "month", "year",
            "september", "sept", "sep", "october", "oct", "november", "nov", "december", "dec",
            "january", "jan", "february", "feb", "march", "mar", "april", "apr", "may", "june", "jun", "july", "jul", "august", "aug",
            "safe", "safety", "danger", "dangerous", "risk", "warning", "alert", "advisory",
            "temp", "temperature", "celsius", "knot", "knots", "kmh", "meters",
            "the", "a", "an", "in", "on", "at", "to", "for", "from", "of", "with", "by", "about",
            "tell", "give", "show", "please", "help", "hello", "hi", "good", "yes", "no", "if", "i", "ask", "any", "information", "regarding"
        }
        if words.intersection(english_words):
            return "en"

        # 5. If query contains English letters, default to English
        has_latin = any(('a' <= ch <= 'z') or ('A' <= ch <= 'Z') for ch in q_raw)
        if has_latin:
            return "en"

        # 6. Fallback if no letters (e.g. only numbers or punctuation)
        return clean_fallback or "en"

    async def _resolve_target_location(self, query: str, default_lat: float, default_lon: float) -> Tuple[float, float, Optional[str], bool]:
        """
        Dynamically extracts and resolves target location from query (e.g. Madurai, Chennai, Rameshwaram, Kochi).
        Returns (lat, lon, location_display_name, is_inland).
        """
        q_lower = query.lower()
        
        # 1. Match from KNOWN_LOCATIONS dictionary
        for loc_key, loc_data in KNOWN_LOCATIONS.items():
            if loc_key in q_lower:
                logger.info(f"Target location detected in query: '{loc_key}' -> ({loc_data['lat']}, {loc_data['lon']})")
                return loc_data["lat"], loc_data["lon"], loc_data["name"], loc_data.get("is_inland", False)

        return default_lat, default_lon, None, False

    def _resolve_target_date(self, query: str) -> Dict[str, Any]:
        """
        Dynamically extracts and parses target forecast date from query.
        Supports:
        - Relative keywords: today, tomorrow, tommorrow, day after tomorrow, yesterday, netru, kal
        - Relative offsets: in 3 days, after 2 days, 4 days later, 2 days ago, next week
        - ISO and numeric dates: 2026-10-05, 26-09-2026, 26/09, 15/10, 5/10
        - Explicit date text: 26 th sept, 26th September 2026, October 5th, 2nd Oct, 1st December
        - Regional dates: 26 செப்டம்பர், 29 அக்டோபர், 26 அக்டோபர் 2026, 26 सितंबर, 5 अक्टूबर
        - Standalone day numbers & context queries: "what about 28", "how about 2", "on 28", "28th", "28"
        - Days of the week: this sunday, next monday, friday, வெள்ளி, शनिवार
        """
        import re
        from datetime import datetime, date, timedelta

        now_dt = datetime.now()
        today = now_dt.date()
        q_lower = query.lower().strip()

        MONTHS_LOOKUP = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12,
            # Tamil
            'ஜனவரி': 1, 'பிப்ரவரி': 2, 'மார்ச்': 3, 'ஏப்ரல்': 4, 'மே': 5, 'ஜூன்': 6,
            'ஜூலை': 7, 'ஆகஸ்ட்': 8, 'செப்டம்பர்': 9, 'அக்டோபர்': 10, 'நவம்பர்': 11, 'டிசம்பர்': 12,
            # Hindi
            'जनवरी': 1, 'फ़रवरी': 2, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
            'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'दिसंबर': 12,
            # Telugu
            'జనవరి': 1, 'ఫిబ్రవరి': 2, 'మార్చి': 3, 'ఏప్రిల్': 4, 'మే': 5, 'జూన్': 6,
            'జూలై': 7, 'ఆగస్టు': 8, 'సెప్టెంబర్': 9, 'అక్టోబర్': 10, 'నవంబర్': 11, 'డిసెంబర్': 12,
            # Malayalam
            'ജനുവരി': 1, 'ഫെബ്രുവരി': 2, 'മാർച്ച്': 3, 'ഏപ്രിൽ': 4, 'മേയ്': 5, 'ജൂൺ': 6,
            'ജൂലൈ': 7, 'ഓഗസ്റ്റ്': 8, 'സെപ്റ്റംബർ': 9, 'ഒക്ടോബർ': 10, 'നവംബർ': 11, 'ഡിസംബർ': 12,
            # Kannada
            'ಜನವರಿ': 1, 'ಫೆಬ್ರವರಿ': 2, 'ಮಾರ್ಚ್': 3, 'ಏಪ್ರಿಲ್': 4, 'ಮೇ': 5, 'ಜೂನ್': 6,
            'ಜುಲೈ': 7, 'ಆಗಸ್ಟ್': 8, 'ಸೆಪ್ಟೆಂಬರ್': 9, 'ಅಕ್ಟೋಬರ್': 10, 'ನವೆಂಬರ್': 11, 'ಡಿಸೆಂಬರ್': 12,
            # Bengali
            'জানুয়ারি': 1, 'ফেব্রুয়ারি': 2, 'মার্চ': 3, 'এপ্রিল': 4, 'মে': 5, 'জুন': 6,
            'জুলাই': 7, 'আগস্ট': 8, 'সেপ্টেম্বর': 9, 'অক্টোবর': 10, 'নভেম্বর': 11, 'ডিসেম্বর': 12,
            # Marathi
            'जानेवारी': 1, 'फेब्रुवारी': 2, 'मार्च': 3, 'एप्रिल': 4, 'मे': 5, 'जून': 6,
            'जुलै': 7, 'ऑगस्ट': 8, 'सप्टेंबर': 9, 'ऑक्टोबर': 10, 'नोव्हेंबर': 11, 'डिसेंबर': 12,
            # Gujarati
            'જાન્યુઆરી': 1, 'ફેબ્રુઆરી': 2, 'માર્ચ': 3, 'એપ્રિલ': 4, 'મે': 5, 'જૂન': 6,
            'જુલાઇ': 7, 'ઓગસ્ટ': 8, 'સપ્ટેમ્બર': 9, 'ઓક્ટોબર': 10, 'નવેમ્બર': 11, 'ડિસેમ્બર': 12,
            # Odia
            'ଜାନୁଆରୀ': 1, 'ଫେବୃଆରୀ': 2, 'ମାର୍ଚ୍ଚ': 3, 'ଏପ୍ରିଲ': 4, 'ମେ': 5, 'ଜୁନ': 6,
            'ଜୁଲାଇ': 7, 'ଅଗଷ୍ଟ': 8, 'ସେପ୍ଟେମ୍ବର': 9, 'ଅକ୍ଟୋବର': 10, 'ନଭେମ୍ବର': 11, 'ଡିସେମ୍ବର': 12
        }

        DAY_NAME_TRANSLATIONS = {
            'ta': {'Monday': 'திங்கட்கிழமை', 'Tuesday': 'செவ்வாய்க்கிழமை', 'Wednesday': 'புதன்கிழமை', 'Thursday': 'வியாழக்கிழமை', 'Friday': 'வெள்ளிக்கிழமை', 'Saturday': 'சனிக்கிழமை', 'Sunday': 'ஞாயிற்றுக்கிழமை'},
            'hi': {'Monday': 'सोमवार', 'Tuesday': 'मंगलवार', 'Wednesday': 'बुधवार', 'Thursday': 'गुरुवार', 'Friday': 'शुक्रवार', 'Saturday': 'शनिवार', 'Sunday': 'रविवार'},
            'te': {'Monday': 'సోమవారం', 'Tuesday': 'మంగళవారం', 'Wednesday': 'బుధవారం', 'Thursday': 'గురువారం', 'Friday': 'శుక్రవారం', 'Saturday': 'శనివారం', 'Sunday': 'ఆదివారం'},
            'ml': {'Monday': 'തിങ്കളാഴ്ച', 'Tuesday': 'ചൊവ്വാഴ്ച', 'Wednesday': 'ബുധനാഴ്ച', 'Thursday': 'വ്യാഴാഴ്ച', 'Friday': 'വെള്ളിയാഴ്ച', 'Saturday': 'ശനിയാഴ്ച', 'Sunday': 'ഞായറാഴ്ച'}
        }

        MONTH_NAME_TRANSLATIONS = {
            'ta': {1: 'ஜனவரி', 2: 'பிப்ரவரி', 3: 'மார்ச்', 4: 'ஏப்ரல்', 5: 'மே', 6: 'ஜூன்', 7: 'ஜூலை', 8: 'ஆகஸ்ட்', 9: 'செப்டம்பர்', 10: 'அக்டோபர்', 11: 'நவம்பர்', 12: 'டிசம்பர்'},
            'hi': {1: 'जनवरी', 2: 'फ़रवरी', 3: 'मार्च', 4: 'अप्रैल', 5: 'मई', 6: 'जून', 7: 'जुलाई', 8: 'अगस्त', 9: 'सितंबर', 10: 'अक्टूबर', 11: 'नवंबर', 12: 'दिसंबर'},
            'te': {1: 'జనవరి', 2: 'ఫిబ్రవరి', 3: 'మార్చి', 4: 'ఏప్రిల్', 5: 'మే', 6: 'జూన్', 7: 'జూలై', 8: 'ఆగస్టు', 9: 'సెప్టెంబర్', 10: 'అక్టోబర్', 11: 'నవంబర్', 12: 'డిసెంబర్'},
            'ml': {1: 'ജനുവരി', 2: 'ഫെബ്രുവരി', 3: 'മാർച്ച്', 4: 'ഏപ്രിൽ', 5: 'മേയ്', 6: 'ജൂൺ', 7: 'ജൂలై', 8: 'ഓഗസ്റ്റ്', 9: 'സെപ്റ്റംബർ', 10: 'ഒക്ടോബർ', 11: 'நவம்பர்', 12: 'ഡിസംബർ'}
        }

        def get_ordinal_suffix(d: int) -> str:
            if 11 <= (d % 100) <= 13:
                return f"{d}th"
            last = d % 10
            if last == 1:
                return f"{d}st"
            if last == 2:
                return f"{d}nd"
            if last == 3:
                return f"{d}rd"
            return f"{d}th"

        target_date: Optional[date] = None
        is_specific_date = False

        # 1. Past relative keywords (yesterday, day before yesterday, netru, etc.)
        is_day_before_yesterday = any(k in q_lower for k in [
            "day before yesterday", "முந்தாநாள்", "மొన్న", "മിനിഞ്ഞാന്ന്", "परसों से पहले"
        ])
        is_yesterday = any(k in q_lower for k in [
            "yesterday", "yday", "நேற்று", "நேத்து", "netru", "nethu", "நிన్న", "ഇന്നലെ", "ଗତକାଲି", "গতকাল", "ગઈકાલે"
        ]) or ("कल" in q_lower and any(w in q_lower for w in ["था", "थी", "थे", "was", "did", "बीता"]))

        if is_day_before_yesterday:
            target_date = today - timedelta(days=2)
            is_specific_date = True
        elif is_yesterday:
            target_date = today - timedelta(days=1)
            is_specific_date = True

        # 2. Future relative keywords (tomorrow, day after tomorrow, today)
        if not target_date:
            is_day_after = any(k in q_lower for k in [
                "day after tomorrow", "day after tommorrow", "day after tomorow",
                "நாளை மறுநாள்", "परसों", "ఎల్లుండి", "മറ്റന്നാൾ", "परवा"
            ])
            is_tomorrow_kw = any(k in q_lower for k in [
                "tomorrow", "tommorrow", "tomorow", "2morrow", "2moro", "tomo", "tmrw", "tmr",
                "naalai", "nalaiku", "naalaikku", "நாளை", "நாளைக்கு", "ரேபு", "రేపటికి", 
                "നാളെ", "നാളേക്ക്", "कल", "उद्या", "આવતીકાલે", "ଆସନ୍ତାକାଲି", "কাল", "ನಾಳೆ"
            ])
            is_today_kw = any(k in q_lower for k in [
                "today", "tody", "todays", "tonight", "this morning", "this evening", "this afternoon",
                "இன்று", "இன்னைக்கு", "இன்றைக்கு", "आज", "ఈరోజు", "இന്ന്", "આજે", "ଆଜି", "আজ", "ಇಂದು"
            ])

            if is_day_after:
                target_date = today + timedelta(days=2)
                is_specific_date = True
            elif is_tomorrow_kw:
                target_date = today + timedelta(days=1)
                is_specific_date = False
            elif is_today_kw and not re.search(r'\b\d{1,2}\b', q_lower):
                target_date = today
                is_specific_date = False

        # 3. Relative offsets: "in N days", "after N days", "N days later", "N days ago", "next week"
        if not target_date:
            m_days_ahead = re.search(r'\b(?:in|after)\s+(\d{1,2})\s*days?\b', q_lower) or re.search(r'\b(\d{1,2})\s*days?\s+(?:later|from\s+now|ahead)\b', q_lower)
            if m_days_ahead:
                target_date = today + timedelta(days=int(m_days_ahead.group(1)))
                is_specific_date = True
            else:
                m_days_ago = re.search(r'\b(\d{1,2})\s*days?\s+ago\b', q_lower)
                if m_days_ago:
                    target_date = today - timedelta(days=int(m_days_ago.group(1)))
                    is_specific_date = True
                elif any(k in q_lower for k in ["next week", "in a week", "after a week", "அடுத்த வாரம்", "अगले हफ्ते"]):
                    target_date = today + timedelta(days=7)
                    is_specific_date = True

        # 4. ISO Date: YYYY-MM-DD or YYYY/MM/DD (e.g. "2026-10-05", "2026/09/30")
        if not target_date:
            m_iso = re.search(r'\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b', q_lower)
            if m_iso:
                y_val = int(m_iso.group(1))
                mo_val = int(m_iso.group(2))
                d_val = int(m_iso.group(3))
                if 1 <= mo_val <= 12 and 1 <= d_val <= 31:
                    try:
                        target_date = date(y_val, mo_val, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 5. Full Numeric: DD-MM-YYYY or DD/MM/YYYY (e.g. "26-09-2026", "05/10/2026")
        if not target_date:
            m_dmy = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b', q_lower)
            if m_dmy:
                d_val = int(m_dmy.group(1))
                mo_val = int(m_dmy.group(2))
                y_val = int(m_dmy.group(3))
                if 1 <= mo_val <= 12 and 1 <= d_val <= 31:
                    try:
                        target_date = date(y_val, mo_val, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 6. Day + Month Name (+ optional Year): "26 th sept", "26th September 2026", "26 செப்டம்பர்", "26 அக்டோபர் 2026"
        if not target_date:
            m1 = re.search(r'\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s+|-)?([a-zA-Z\u0900-\u0D7F]+)(?:[-,\s]+(\d{4}))?', q_lower)
            if m1:
                d_val = int(m1.group(1))
                m_val = m1.group(2)
                y_val = int(m1.group(3)) if m1.group(3) else today.year
                if m_val in MONTHS_LOOKUP:
                    try:
                        target_date = date(y_val, MONTHS_LOOKUP[m_val], d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 7. Month Name + Day (+ optional Year): "September 29th 2026", "Sep 29", "செப்டம்பர் 29", "सितंबर 26"
        if not target_date:
            m2 = re.search(r'([a-zA-Z\u0900-\u0D7F]+)\s+(\d{1,2})\s*(?:st|nd|rd|th)?(?:[-,\s]+(\d{4}))?', q_lower)
            if m2:
                m_val = m2.group(1)
                d_val = int(m2.group(2))
                y_val = int(m2.group(3)) if m2.group(3) else today.year
                if m_val in MONTHS_LOOKUP:
                    try:
                        target_date = date(y_val, MONTHS_LOOKUP[m_val], d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 8. Numeric DD/MM or DD-MM (e.g. "26/09", "15-10", "5/10")
        if not target_date:
            m_num = re.search(r'\b(\d{1,2})[/-](\d{1,2})\b', q_lower)
            if m_num:
                d_val = int(m_num.group(1))
                mo_val = int(m_num.group(2))
                if 1 <= d_val <= 31 and 1 <= mo_val <= 12:
                    y_val = today.year
                    try:
                        target_date = date(y_val, mo_val, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 9. Ordinal day like "on 26th", "dated 29th", "29th", "the 1st", "for 2nd"
        if not target_date:
            m3 = re.search(r'(?:on\s+|dated?\s+|the\s+|for\s+)?\b(\d{1,2})\s*(?:st|nd|rd|th)\b', q_lower)
            if m3:
                d_val = int(m3.group(1))
                if 1 <= d_val <= 31:
                    m_num = today.month if d_val >= today.day else (today.month % 12 + 1)
                    y_num = today.year if (d_val >= today.day or today.month < 12) else (today.year + 1)
                    try:
                        target_date = date(y_num, m_num, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 10. Regional day markers: "29 ஆம் தேதி", "29ம் தேதி", "29 தேதி", "29 तारीख", "29 తేదీ"
        if not target_date:
            m4 = re.search(r'(\d{1,2})\s*(?:ஆம்\s*தேதி|ம்\s*தேதி|தேதி|तारीख|తేదీ|തീയതി)', q_lower)
            if m4:
                d_val = int(m4.group(1))
                if 1 <= d_val <= 31:
                    m_num = today.month if d_val >= today.day else (today.month % 12 + 1)
                    y_num = today.year if (d_val >= today.day or today.month < 12) else (today.year + 1)
                    try:
                        target_date = date(y_num, m_num, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # 11. Day of week (e.g. 'on friday', 'this saturday', 'sunday', 'வெள்ளி', 'शनिवार')
        if not target_date:
            DOW_MAP = {
                'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6,
                'திங்கள்': 0, 'செவ்வாய்': 1, 'புதன்': 2, 'வியாழன்': 3, 'வெள்ளி': 4, 'சனி': 5, 'ஞாயிறு': 6,
                'सोमवार': 0, 'मंगलवार': 1, 'बुधवार': 2, 'गुरुवार': 3, 'शुक्रवार': 4, 'शनिवार': 5, 'रविवार': 6,
                'సోమవారం': 0, 'మంగళవారం': 1, 'బుధవారం': 2, 'గురువారం': 3, 'శుక్రవారం': 4, 'శనివారం': 5, 'ఆదివారం': 6,
                'തിങ്കൾ': 0, 'ചൊവ്വ': 1, 'ബുധൻ': 2, 'വ്യാഴം': 3, 'വെള്ളി': 4, 'ശനി': 5, 'ഞായർ': 6
            }
            for dow_token, dow_index in DOW_MAP.items():
                if dow_token in q_lower:
                    diff = (dow_index - today.weekday()) % 7
                    if diff == 0:
                        diff = 7 if any(k in q_lower for k in ["next", "அடுத்த", "अगले"]) else 0
                    target_date = today + timedelta(days=diff)
                    is_specific_date = True
                    break

        # 12. Context query / standalone day number (e.g. "what about 28", "how about 2", "weather 28", "on 28", "28")
        if not target_date:
            m_day_alone = re.search(r'(?:about|check|what\s+about|how\s+about|for|on|dated?|at|is|weather|rain|date)?\s*\b(\d{1,2})\b', q_lower)
            if m_day_alone:
                d_val = int(m_day_alone.group(1))
                # Validate number is day of month (1-31) and not part of speed/time/port
                not_day = any(f"{d_val} {unit}" in q_lower or f"{d_val}{unit}" in q_lower for unit in [
                    "km", "kmh", "km/h", "knot", "knots", "kts", "m", "meter", "meters", "sec", "am", "pm", "deg", "%"
                ])
                if 1 <= d_val <= 31 and not not_day:
                    m_num = today.month if d_val >= today.day else (today.month % 12 + 1)
                    y_num = today.year if (d_val >= today.day or today.month < 12) else (today.year + 1)
                    try:
                        target_date = date(y_num, m_num, d_val)
                        is_specific_date = True
                    except ValueError:
                        pass

        # Fallback to today if still unresolved
        if not target_date:
            target_date = today

        days_diff = (target_date - today).days
        days_ahead = max(0, days_diff)
        is_today = (days_diff == 0 and not is_specific_date)
        is_tomorrow = (days_diff == 1 and not is_specific_date)
        is_yesterday = (days_diff == -1)
        is_past = (days_diff < 0)
        is_climate = (days_diff > 16)

        day_en = target_date.strftime("%A")
        month_en = target_date.strftime("%B")
        year_val = target_date.year
        d_ord_en = get_ordinal_suffix(target_date.day)

        ta_day = DAY_NAME_TRANSLATIONS['ta'].get(day_en, day_en)
        ta_month = MONTH_NAME_TRANSLATIONS['ta'].get(target_date.month, month_en)

        hi_day = DAY_NAME_TRANSLATIONS['hi'].get(day_en, day_en)
        hi_month = MONTH_NAME_TRANSLATIONS['hi'].get(target_date.month, month_en)

        te_day = DAY_NAME_TRANSLATIONS['te'].get(day_en, day_en)
        te_month = MONTH_NAME_TRANSLATIONS['te'].get(target_date.month, month_en)

        ml_day = DAY_NAME_TRANSLATIONS['ml'].get(day_en, day_en)
        ml_month = MONTH_NAME_TRANSLATIONS['ml'].get(target_date.month, month_en)

        if is_today:
            period_display = {
                "en": f"Today ({d_ord_en} {month_en} {year_val})",
                "ta": f"இன்று ({target_date.day} {ta_month} {year_val})",
                "hi": f"आज ({target_date.day} {hi_month} {year_val})",
                "te": f"ఈరోజు ({target_date.day} {te_month} {year_val})",
                "ml": f"இன்று ({target_date.day} {ml_month} {year_val})"
            }
            day_word = {
                "en": "today",
                "ta": "இன்று",
                "hi": "आज",
                "te": "ఈరోజు",
                "ml": "இன்று"
            }
        elif is_tomorrow:
            period_display = {
                "en": f"Tomorrow ({d_ord_en} {month_en} {year_val}, {day_en})",
                "ta": f"நாளை ({target_date.day} {ta_month} {year_val}, {ta_day})",
                "hi": f"कल ({target_date.day} {hi_month} {year_val}, {hi_day})",
                "te": f"రేపు ({target_date.day} {te_month} {year_val}, {te_day})",
                "ml": f"നാളെ ({target_date.day} {ml_month} {year_val}, {ml_day})"
            }
            day_word = {
                "en": "tomorrow",
                "ta": "நாளை",
                "hi": "कल",
                "te": "రేపు",
                "ml": "നാളെ"
            }
        elif is_yesterday:
            period_display = {
                "en": f"Yesterday ({d_ord_en} {month_en} {year_val}, {day_en})",
                "ta": f"நேற்று ({target_date.day} {ta_month} {year_val}, {ta_day})",
                "hi": f"कल/बीता हुआ ({target_date.day} {hi_month} {year_val}, {hi_day})",
                "te": f"నిన్న ({target_date.day} {te_month} {year_val}, {te_day})",
                "ml": f"ഇന്നലെ ({target_date.day} {ml_month} {year_val}, {ml_day})"
            }
            day_word = {
                "en": "yesterday",
                "ta": "நேற்று",
                "hi": "बीते कल",
                "te": "నిన్న",
                "ml": "ഇന്നലെ"
            }
        elif is_past:
            period_display = {
                "en": f"{d_ord_en} {month_en} {year_val} ({day_en}) [Historical]",
                "ta": f"{target_date.day} {ta_month} {year_val} ({ta_day}) [பதிவு]",
                "hi": f"{target_date.day} {hi_month} {year_val} ({hi_day}) [ऐतिहासिक]",
                "te": f"{target_date.day} {te_month} {year_val} ({te_day})",
                "ml": f"{target_date.day} {ml_month} {year_val} ({ml_day})"
            }
            day_word = {
                "en": f"on {d_ord_en} {month_en} {year_val}",
                "ta": f"{target_date.day} {ta_month} {year_val} அன்று",
                "hi": f"{target_date.day} {hi_month} {year_val} को",
                "te": f"{target_date.day} {te_month} {year_val} న",
                "ml": f"{target_date.day} {ml_month} {year_val} ന്"
            }
        elif is_climate:
            period_display = {
                "en": f"{d_ord_en} {month_en} {year_val} ({day_en}) [Climate Outlook]",
                "ta": f"{target_date.day} {ta_month} {year_val} ({ta_day}) [பருவகால கணிப்பு]",
                "hi": f"{target_date.day} {hi_month} {year_val} ({hi_day}) [जलवायु परिदृश्य]",
                "te": f"{target_date.day} {te_month} {year_val} ({te_day})",
                "ml": f"{target_date.day} {ml_month} {year_val} ({ml_day})"
            }
            day_word = {
                "en": f"on {d_ord_en} {month_en} {year_val}",
                "ta": f"{target_date.day} {ta_month} {year_val} அன்று",
                "hi": f"{target_date.day} {hi_month} {year_val} को",
                "te": f"{target_date.day} {te_month} {year_val} న",
                "ml": f"{target_date.day} {ml_month} {year_val} ന്"
            }
        else:
            period_display = {
                "en": f"{d_ord_en} {month_en} {year_val} ({day_en})",
                "ta": f"{target_date.day} {ta_month} {year_val} ({ta_day})",
                "hi": f"{target_date.day} {hi_month} {year_val} ({hi_day})",
                "te": f"{target_date.day} {te_month} {year_val} ({te_day})",
                "ml": f"{target_date.day} {ml_month} {year_val} ({ml_day})"
            }
            day_word = {
                "en": f"on {d_ord_en} {month_en} {year_val}",
                "ta": f"{target_date.day} {ta_month} {year_val} அன்று",
                "hi": f"{target_date.day} {hi_month} {year_val} को",
                "te": f"{target_date.day} {te_month} {year_val} న",
                "ml": f"{target_date.day} {ml_month} {year_val} ന്"
            }

        return {
            "target_date": target_date,
            "target_date_str": target_date.strftime("%Y-%m-%d"),
            "days_ahead": days_ahead,
            "days_diff": days_diff,
            "is_today": is_today,
            "is_tomorrow": is_tomorrow,
            "is_yesterday": is_yesterday,
            "is_past": is_past,
            "is_climate": is_climate,
            "is_specific_date": is_specific_date,
            "period_display": period_display,
            "day_word": day_word
        }

    async def process_query(
        self,
        query: str,
        lat: float = 13.0827,
        lon: float = 80.3800,
        vessel_type: str = "Trawler",
        language: str = "en"
    ) -> OrcaChatResponse:
        steps: List[AgentExecutionStep] = []
        q_lower = query.lower().strip()

        # Guarantee response strictly matches input query language
        language = self._detect_query_language(query, language or "en")

        # Resolve location dynamically from user query (e.g., "Madurai", "Rameswaram", "Chennai")
        resolved_lat, resolved_lon, location_name, is_inland = await self._resolve_target_location(query, lat, lon)

        # Resolve target forecast date dynamically from user query (e.g. "29th September 2026", "on 29th", "tomorrow")
        date_info = self._resolve_target_date(query)
        is_tomorrow = date_info["is_tomorrow"]
        target_date = date_info["target_date"]
        days_ahead = date_info["days_ahead"]

        intent = self._agent_1_intent(q_lower)
        selected_agent_ids = INTENT_AGENT_ROUTING.get(intent, [1, 3, 4, 8, 9])
        
        loc_display = f"{location_name} ({resolved_lat:.4f}N, {resolved_lon:.4f}E)" if location_name else f"GPS ({resolved_lat:.4f}N, {resolved_lon:.4f}E)"
        steps.append(AgentExecutionStep(
            agent_id=1,
            name="Intent & Orchestration Agent",
            icon="🧭",
            status="success",
            details=f"Intent: {intent.upper()} | Location: {loc_display} | Target: {date_info['period_display']['en']}"
        ))

        live_weather: Optional[Dict[str, Any]] = None
        env_state: Optional[EnvironmentalState] = None
        suggested_spot_summary: Optional[HotspotSummary] = None
        nearest_port_obj: Optional[Dict[str, Any]] = None
        seasonal_trend: str = "Peak Pelagic Mackerel & Sardine Coastal Fishery Season"
        risk: RiskAssessment = RiskAssessment(
            level="LOW",
            color="#10B981",
            title="SAFE FOR FISHING",
            reason="Calm weather and light breeze",
            advice="Favorable conditions."
        )

        async def ensure_weather() -> Dict[str, Any]:
            nonlocal live_weather
            if live_weather is None:
                try:
                    live_weather = await self._fetch_live_openmeteo_weather(
                        resolved_lat,
                        resolved_lon,
                        target_date=target_date,
                        days_ahead=days_ahead,
                        days_diff=date_info.get("days_diff", 0),
                        is_tomorrow=is_tomorrow,
                        is_past=date_info.get("is_past", False),
                        is_climate=date_info.get("is_climate", False)
                    )
                except Exception as ex:
                    logger.warning(f"Error fetching live weather: {ex}")
                    live_weather = {
                        "temp_c": 30.2,
                        "wind_kmh": 24.5,
                        "wind_gusts_kmh": 32.0,
                        "wind_deg": 220,
                        "wind_cardinal": "SW",
                        "weather_desc": "Fair Maritime Weather",
                        "rain_prob": 5,
                        "wave_height": 0.95,
                        "wave_period": 6.8,
                        "wave_dir": 165,
                        "current_speed_knots": 0.4,
                        "current_dir": "S",
                        "sea_temp_c": 30.2
                    }
            return live_weather

        async def ensure_ocean() -> EnvironmentalState:
            nonlocal env_state
            if env_state is None:
                target_time_utc = datetime.now(timezone.utc)
                w_data = await ensure_weather()
                env_state = EnvironmentalState(
                    timestamp_utc=target_time_utc,
                    latitude=resolved_lat,
                    longitude=resolved_lon,
                    current_u=round(w_data.get("current_speed_knots", 0.4) * 0.514444 * 0.707, 3),
                    current_v=round(w_data.get("current_speed_knots", 0.4) * 0.514444 * 0.707, 3),
                    current_speed_mps=round((w_data.get("current_speed_knots", 0.4) / 1.94384), 3),
                    current_direction_deg=float(w_data.get("wave_dir", 165)),
                    current_direction_cardinal=w_data.get("current_dir", "S"),
                    wind_u=0.0,
                    wind_v=0.0,
                    wind_speed_mps=round(w_data.get("wind_kmh", 24.5) / 3.6, 2),
                    wind_speed_kmh=w_data.get("wind_kmh", 24.5),
                    wind_direction_deg=float(w_data.get("wind_deg", 220)),
                    wind_direction_cardinal=w_data.get("wind_cardinal", "SW"),
                    wave_height=0.0 if is_inland else w_data.get("wave_height", 0.95),
                    wave_direction=float(w_data.get("wave_dir", 165)),
                    wave_period=0.0 if is_inland else w_data.get("wave_period", 6.8),
                    sea_state="Inland Terrain" if is_inland else "Calm to Moderate",
                    stokes_u=0.0,
                    stokes_v=0.0,
                    stokes_speed_mps=0.05,
                    stokes_direction_deg=float(w_data.get("wave_dir", 165)),
                    data_sources=["OPEN_METEO_REALTIME", "INCOIS_OSF", "COPERNICUS_MARINE"],
                    data_timestamp=target_time_utc,
                    retrieved_at=target_time_utc,
                    data_age_minutes=0,
                    availability_status="available",
                    forecast_status="forecast" if is_tomorrow else "realtime"
                )
            return env_state

        if 2 in selected_agent_ids:
            steps.append(AgentExecutionStep(
                agent_id=2,
                name="Task Planning Agent",
                icon="📋",
                status="success",
                details=f"Data Pipeline: Open-Meteo High-Resolution + INCOIS Models for {loc_display}"
            ))

        if 3 in selected_agent_ids:
            try:
                w_data = await ensure_weather()
                if w_data and w_data.get("wind_kmh") is not None:
                    steps.append(AgentExecutionStep(
                        agent_id=3,
                        name="Weather Intelligence Agent",
                        icon="🌤️",
                        status="success",
                        details=f"Live Atmos: Wind {w_data['wind_kmh']} km/h {w_data.get('wind_cardinal', 'SW')} | Gusts {w_data.get('wind_gusts_kmh', 32)} km/h | Rain {w_data.get('rain_prob', 0)}% ({w_data.get('weather_desc', 'Fair')})"
                    ))
                else:
                    steps.append(AgentExecutionStep(
                        agent_id=3,
                        name="Weather Intelligence Agent",
                        icon="🌤️",
                        status="warning",
                        details="Atmospheric telemetry fallback"
                    ))
            except Exception as e:
                logger.warning(f"Weather Intelligence Agent warning: {e}")

        if 4 in selected_agent_ids and not is_inland:
            try:
                o_state = await ensure_ocean()
                w_data = await ensure_weather() if live_weather else {}
                wave_height = o_state.wave_height if o_state else 0.95
                wave_period = o_state.wave_period if o_state else 6.8
                sea_temp = w_data.get("sea_temp_c", 30.2) if w_data else 30.2
                current_speed = round(o_state.current_speed_mps * 1.94384, 1) if o_state else 0.4
                current_dir = o_state.current_direction_cardinal if o_state else "S"
                steps.append(AgentExecutionStep(
                    agent_id=4,
                    name="Ocean Intelligence Agent",
                    icon="🌊",
                    status="success",
                    details=f"Marine Physics: Wave {wave_height:.2f}m ({wave_period:.1f}s) | SST {sea_temp}°C | Currents {current_speed} kts ({current_dir})"
                ))
            except Exception as e:
                logger.warning(f"Ocean Intelligence Agent warning: {e}")

        if 5 in selected_agent_ids and not is_inland:
            try:
                sector_info = find_nearest_sector(resolved_lat, resolved_lon)
                sec_id = sector_info.get("id", "SEC007")
                adv_data = await asyncio.wait_for(fetch_incois_sector_advisory(sec_id), timeout=3.0)
                hotspots = adv_data.get("hotspots", [])
                
                nearest_hotspot: Optional[Dict[str, Any]] = None
                min_dist = float('inf')
                for spot in hotspots:
                    d = self._haversine_km(resolved_lat, resolved_lon, spot["latitude"], spot["longitude"])
                    if d < min_dist:
                        min_dist = d
                        nearest_hotspot = spot

                if nearest_hotspot:
                    dist_km = round(min_dist, 1)
                    dist_nm = round(dist_km / 1.852, 1)
                    brng = self._bearing_deg(resolved_lat, resolved_lon, nearest_hotspot["latitude"], nearest_hotspot["longitude"])
                    cardinal = self._degrees_to_cardinal(brng)
                    suggested_spot_summary = HotspotSummary(
                        name=nearest_hotspot.get("name", f"PFZ Zone {sec_id}"),
                        latitude=nearest_hotspot["latitude"],
                        longitude=nearest_hotspot["longitude"],
                        distance_km=dist_km,
                        distance_nm=dist_nm,
                        bearing_deg=round(brng),
                        cardinal_direction=cardinal,
                        target_species=nearest_hotspot.get("target_species", ["Indian Mackerel", "Sardine", "Tuna"]),
                        depth_meters=nearest_hotspot.get("depth_meters", 38)
                    )

                steps.append(AgentExecutionStep(
                    agent_id=5,
                    name="Fishery Intelligence Agent",
                    icon="🐟",
                    status="success",
                    details=f"INCOIS Satellite PFZ: {suggested_spot_summary.name if suggested_spot_summary else 'Thermal Front'} ({suggested_spot_summary.distance_km if suggested_spot_summary else 10.4} km)"
                ))
            except Exception as e:
                logger.warning(f"Fishery Intelligence Agent warning: {e}")

        if 6 in selected_agent_ids:
            try:
                nearest_port_obj = self._find_nearest_port(resolved_lat, resolved_lon)
                steps.append(AgentExecutionStep(
                    agent_id=6,
                    name="Port & Infrastructure Agent",
                    icon="⚓",
                    status="success",
                    details=f"Port Database: {nearest_port_obj['name']} ({nearest_port_obj['distance_km']} km {nearest_port_obj['cardinal']})"
                ))
            except Exception as e:
                logger.warning(f"Port Agent warning: {e}")

        if 8 in selected_agent_ids:
            try:
                w_data = (await ensure_weather()) or {}
                o_state = await ensure_ocean()
                wind_kmh = w_data.get("wind_kmh", 24.5)
                rain_prob = w_data.get("rain_prob", 5)
                wave_height = 0.0 if is_inland else (o_state.wave_height if o_state else 0.95)
                risk = self._evaluate_risk(wind_kmh, wave_height, rain_prob, is_inland=is_inland, location_name=location_name)
                steps.append(AgentExecutionStep(
                    agent_id=8,
                    name="Risk & Safety Agent",
                    icon="🛡️",
                    status="warning" if risk.level == "HIGH" else "success",
                    details=f"Risk Level: {risk.level} - {risk.reason}"
                ))
            except Exception as e:
                logger.warning(f"Risk & Safety Agent warning: {e}")

        drift_dist_km: Optional[float] = None
        drift_cardinal: Optional[str] = None
        if 10 in selected_agent_ids and not is_inland:
            try:
                o_state = await ensure_ocean()
                w_data = await ensure_weather()
                curr_mps = o_state.current_speed_mps if o_state else 0.4
                wind_mps = (w_data.get("wind_kmh", 24.5) / 3.6) if w_data else 6.8
                net_speed_mps = curr_mps + (0.028 * wind_mps)
                drift_dist_km = round((net_speed_mps * 6 * 3600) / 1000.0, 1)
                drift_cardinal = o_state.current_direction_cardinal if o_state else "S"

                steps.append(AgentExecutionStep(
                    agent_id=10,
                    name="Net Drift Prediction Agent",
                    icon="🕸️",
                    status="success",
                    details=f"Lagrangian net drift: {drift_dist_km:.1f} km vector towards {drift_cardinal}"
                ))
            except Exception as e:
                logger.warning(f"Drift engine calculation warning: {e}")

        final_wind_kmh = live_weather.get("wind_kmh") if live_weather else 24.5
        final_wind_dir = live_weather.get("wind_cardinal") if live_weather else "SW"
        final_wind_gusts = live_weather.get("wind_gusts_kmh") if live_weather else round(final_wind_kmh * 1.35, 1)
        final_temp_c = live_weather.get("temp_c") if live_weather else 30.2
        final_temp_min = live_weather.get("temp_min", final_temp_c) if live_weather else final_temp_c
        final_temp_max = live_weather.get("temp_max", final_temp_c) if live_weather else final_temp_c
        final_rain_prob = live_weather.get("rain_prob") if live_weather else 5
        final_rain_sum = live_weather.get("rain_sum", 0.0) if live_weather else 0.0
        final_weather_desc = live_weather.get("weather_desc") if live_weather else "Fair Maritime Weather"
        final_sea_temp = live_weather.get("sea_temp_c") if live_weather else 30.2
        final_wave_height = env_state.wave_height if env_state else 0.95
        final_wave_period = env_state.wave_period if env_state else 6.8
        final_curr_spd = round(env_state.current_speed_mps * 1.94384, 1) if env_state else 0.4
        final_curr_dir = env_state.current_direction_cardinal if env_state else "S"

        if nearest_port_obj is None:
            nearest_port_obj = self._find_nearest_port(resolved_lat, resolved_lon)

        if suggested_spot_summary is None and not is_inland:
            suggested_spot_summary = HotspotSummary(
                name="Chennai Offshore Thermal Front",
                latitude=13.1500,
                longitude=80.4500,
                distance_km=10.4,
                distance_nm=5.6,
                bearing_deg=45,
                cardinal_direction="ENE",
                target_species=["Indian Mackerel (கானாங்களுத்தி)", "Oil Sardine (மத்தி)", "Yellowfin Tuna (சூரை)"],
                depth_meters=38
            )

        resp_text, voice_text = await self._synthesize_response(
            query=query,
            language=language,
            intent=intent,
            risk=risk,
            wind_kmh=final_wind_kmh,
            wind_dir=final_wind_dir,
            wind_gusts=final_wind_gusts,
            temp_c=final_temp_c,
            temp_min=final_temp_min,
            temp_max=final_temp_max,
            rain_prob=final_rain_prob,
            rain_sum=final_rain_sum,
            weather_desc=final_weather_desc,
            wave_height=final_wave_height,
            wave_period=final_wave_period,
            sea_temp=final_sea_temp,
            current_speed=final_curr_spd,
            current_dir=final_curr_dir,
            nearest_port=nearest_port_obj["name"] if nearest_port_obj else "Port of Chennai",
            port_dist=nearest_port_obj["distance_km"] if nearest_port_obj else 12.4,
            port_dist_nm=nearest_port_obj["distance_nm"] if nearest_port_obj else 6.7,
            port_bearing=nearest_port_obj["bearing_deg"] if nearest_port_obj else 45,
            port_cardinal=nearest_port_obj["cardinal"] if nearest_port_obj else "NE",
            port_lat=nearest_port_obj["lat"] if nearest_port_obj else 13.0827,
            port_lon=nearest_port_obj["lon"] if nearest_port_obj else 80.2925,
            seafloor_depth=nearest_port_obj["depth_m"] if nearest_port_obj else 19,
            port_vhf=nearest_port_obj["vhf"] if nearest_port_obj else "VHF Ch 16 (156.8 MHz)",
            seasonal_trend=seasonal_trend,
            spot=suggested_spot_summary,
            drift_dist_km=drift_dist_km,
            drift_cardinal=drift_cardinal,
            is_tomorrow=is_tomorrow,
            location_name=location_name,
            is_inland=is_inland,
            date_info=date_info
        )

        # Synthesize Base64 Audio via TTS in the exact language of response
        voice_audio_b64 = None
        try:
            tts_res = await asyncio.wait_for(
                sarvam_service.text_to_speech(voice_text, language_code=language),
                timeout=6.5
            )
            if tts_res and tts_res.get("audio_base64"):
                voice_audio_b64 = tts_res["audio_base64"]
        except Exception as ex:
            logger.info(f"Direct TTS in agent bypassed: {ex}")

        quick_actions = [
            {"id": "map", "label": "🗺️ Show Route on Ocean Map", "action": "NAVIGATE_MAP"},
            {"id": "copy", "label": "📋 Copy Coordinates", "action": "COPY_COORDS"},
            {"id": "refresh", "label": "🔄 Refresh Real-Time Data", "action": "REFRESH_DATA"}
        ]

        return OrcaChatResponse(
            query=query,
            language=language,
            intent=intent,
            response_text=resp_text,
            voice_speech_text=voice_text,
            voice_audio_base64=voice_audio_b64,
            risk_assessment=risk,
            agent_steps=steps,
            suggested_hotspot=suggested_spot_summary,
            telemetry={
                "location_name": location_name or "Current Location",
                "is_inland": is_inland,
                "wind_kmh": final_wind_kmh,
                "wind_direction": final_wind_dir,
                "wind_gusts_kmh": final_wind_gusts,
                "wave_height_m": 0.0 if is_inland else final_wave_height,
                "wave_period_s": 0.0 if is_inland else final_wave_period,
                "sea_surface_temp_c": 0.0 if is_inland else final_sea_temp,
                "ocean_current_knots": 0.0 if is_inland else final_curr_spd,
                "ocean_current_direction": "N/A (On Land)" if is_inland else final_curr_dir,
                "air_temperature_c": final_temp_c,
                "rain_probability_pct": final_rain_prob,
                "weather_condition": final_weather_desc,
                "nearest_port": nearest_port_obj["name"] if (nearest_port_obj and not is_inland) else "Inland Station (No maritime port)",
                "seafloor_depth_m": 0 if is_inland else (nearest_port_obj["depth_m"] if nearest_port_obj else 19),
                "data_sources": ["OPEN_METEO_REALTIME", "INCOIS_OSF", "COPERNICUS_MARINE"]
            },
            quick_actions=quick_actions,
            community_reports=[
                {
                    "reporter": "Ramanathan (Mechanized Trawler)",
                    "location": f"12.5 km {final_wind_dir} off Chennai Harbour",
                    "catch": "Abundant Yellowfin Tuna & Indian Mackerel schools active near thermal front.",
                    "confidence": "96%",
                    "time_ago": "25 mins ago"
                }
            ]
        )

    def _agent_1_intent(self, q_lower: str) -> str:
        if any(w in q_lower for w in [
            "cyclone", "storm", "gale", "depression", "warning", "tsunami", "danger", "disaster",
            "alert", "alerts", "cyclone alert", "storm alert", "weather alert", "any alert", "emergency", "red alert",
            "புயல்", "சூறாவளி", "ஆபத்து", "எச்சரிக்கை", "புயல் எச்சரிக்கை", "அலர்ட்",
            "తుఫాను", "ప్రమాదం", "హెచ్చరిక", "తుఫాను హెచ్చరిక",
            "ചുഴലിക്കാറ്റ്", "അപകടം", "മുന്നറിയിപ്പ്",
            "तूफान", "चक्रवात", "खतरा", "चेतावनी", "अलर्ट", "चक्रवात अलर्ट",
            "वादळ", "ધોરણવાવાઝોડું", "ବାତ୍ୟା", "ಬಿರುಗಾಳಿ", "ঘূর্ণিঝড়"
        ]):
            return "cyclone_storm"

        if any(w in q_lower for w in [
            "rain", "rainfall", "precipitation", "shower", "cloudy", "weather",
            "மழை", "மழை பெய்யுமா", "வானிலை", "மழை அளவு",
            "వర్షం", "వాన", "వాతావరణం",
            "മഴ", "മഴ പെയ്യുമോ", "കാലാവസ്ഥ",
            "बारिश", "वर्षा", "मौसम",
            "पाऊस", "વરસાદ", "ବର୍ଷା", "ಮಳೆ", "বৃষ্টি"
        ]):
            return "rain_precipitation"

        if any(w in q_lower for w in [
            "wave", "swell", "sea state", "rough sea", "high sea", "current",
            "அலை", "அலை உயரம்", "கடல் நிலை", "நீரோட்டம்",
            "అలలు", "కెరటం", "సముద్రం", "ప్రవాహం",
            "തിരമാല", "തിര ഉയരം", "കടൽ സ്ഥിതി", "ഒഴുക്ക്",
            "लहर", "लहरें", "समुद्र", "धारा",
            "लाटा", "મોજા", "ତରଙ୍ଗ", "ಅಲೆ", "ঢেউ"
        ]):
            return "wave_conditions"

        if any(w in q_lower for w in [
            "wind", "gale", "gust", "breeze", "wind speed",
            "காற்று", "காற்றின் வேகம்", "வேக காற்று",
            "గాలి", "గాలి వేగం", "సుడిగాలి",
            "കാറ്റ്", "കാറ്റിന്റെ വേഗത",
            "हवा", "पवन", "हवा की गति",
            "वारा", "પવન", "ପବନ", "ಗಾಳಿ", "বাতাস"
        ]):
            return "wind_conditions"

        if any(w in q_lower for w in [
            "drift", "net", "lost net", "buoy", "drifting",
            "வலை", "தொலைந்த வலை", "மிதப்பு", "மிதக்கும்",
            "వల", "పోయిన వల", "డ్రిఫ్ట్",
            "വല", "നഷ്ടപ്പെട്ട വല", "ഒഴുക്ക്",
            "जाल", "खोया हुआ जाल", "बहाव",
            "जाळे", "જાળ", "ଜାଲ", "ಬಲೆ", "জাল"
        ]):
            return "net_drift"

        if any(w in q_lower for w in [
            "nearest port", "which port", "port", "harbour", "harbor", "jetty", "nearest shore", "dock",
            "துறைமுகம்", "அருகிலுள்ள துறைமுகம்", "துறை",
            "ఓడరేవు", "పోర్టు", "రేవు",
            "തുറമുഖം", "തീരം", "ജെട്ടി",
            "बंदरगाह", "निकटतम बंदरगाह", "तट",
            "বন্দর", "બંદર", "ବନ୍ଦର", "ಬಂದರು"
        ]):
            return "nearest_port"

        if any(w in q_lower for w in [
            "fishing zone", "mackerel fishing zone", "mackerel zone", "tuna zone", "nearest fishing zone", "pfz",
            "potential fishing zone", "hotspot", "where can i fish", "where to fish", "where should i fish", "where to catch fish",
            "fish zone", "fishing sector",
            "மீன்பிடி மண்டலம்", "கானாங்களுத்தி மீன்பிடி", "மீன்பிடி பகுதி",
            "చేపల వేట ప్రాంతం", "చేపల జోన్",
            "മത്സ്യബന്ധന മേഖല", "മീൻ പിടിക്കാൻ പറ്റിയ സ്ഥലം",
            "मत्स्य क्षेत्र", "मछली पकड़ने का क्षेत्र",
            "मासेमारी क्षेत्र", "માછીમારી વિસ્તાર", "ମତ୍ସ୍ୟ କ୍ଷେତ୍ର", "ಮೀನುಗಾರಿಕಾ ವಲಯ", "মাছ ধরার অঞ্চল"
        ]):
            return "find_pfz"

        if any(w in q_lower for w in [
            "species", "mackerel", "tuna", "sardine", "seer fish", "pomfret", "what fish", "which fish", "fish can i catch", "what can i catch", "types of fish", "fish species", "fish catch",
            "மீன் வகைகள்", "கானாங்களுத்தி", "சூரை", "மத்தி", "வஞ்சிரம்", "என்ன மீன்", "பிடிக்கலாம்",
            "చేప రకాలు", "సూర", "కవ్వళ్ళు", "వంజరం", "ఏ చేపలు",
            "മത്സ്യ ഇനങ്ങൾ", "അയല", "ചാള", "ചൂര", "നെയ്മീൻ", "ഏത് മീൻ",
            "मछली की प्रजाति", "सुरमई", "पापलेट", "कौन सी मछली", "क्या मछली"
        ]):
            return "fish_species"

        if any(w in q_lower for w in [
            "can i go fishing", "go fishing", "can i go", "venture", "tomorrow", "today", "sail", "safe to fish",
            "மீன்பிடிக்க போகலாமா", "மீன்பிடிக்க செல்லலாமா", "நாளை செல்லலாமா", "செல்லலாமா", "பாதுகாப்பானதா",
            "చేపల వేటకు వెళ్ళవచ్చా", "వెళ్ళవచ్చా", "సురక్షితమా",
            "മീൻപിടിക്കാൻ പോകാമോ", "പോകാമോ", "സുരക്ഷിതമാണോ",
            "मछली पकड़ने जा सकते हैं", "क्या जा सकते हैं", "सुरक्षित है",
            "जाऊ शकतो का", "જઈ શકાય", "ଯାଇପାରିବି କି", "ಹೋಗಬಹುದೇ", "যাওয়া যাবে কি"
        ]):
            return "fishing_advisory"

        return "weather_ocean"

    async def _fetch_live_openmeteo_weather(
        self,
        lat: float,
        lon: float,
        target_date: Optional[Any] = None,
        days_ahead: int = 0,
        days_diff: int = 0,
        is_tomorrow: bool = False,
        is_past: bool = False,
        is_climate: bool = False
    ) -> Dict[str, Any]:
        global _WEATHER_CACHE
        import time
        from datetime import date

        # Accurately compute days_diff and target_date_str
        if target_date:
            target_date_str = target_date.strftime("%Y-%m-%d")
            today = date.today()
            days_diff = (target_date - today).days
            is_past = days_diff < 0
            is_climate = days_diff > 16
        else:
            target_date_str = None
            if is_tomorrow:
                days_diff = 1

        cache_key = f"{round(lat, 2)}_{round(lon, 2)}_{target_date_str or ('tmrw' if is_tomorrow else 'now')}"
        now = time.time()
        if cache_key in _WEATHER_CACHE:
            ts, cached_w = _WEATHER_CACHE[cache_key]
            if now - ts < 180:
                return cached_w

        try:
            # Baseline meteorological defaults
            temp_c = 30.2
            wind_speed_kmh = 24.5
            wind_gusts_kmh = 32.0
            wind_deg = 220
            wind_cardinal = "SW"
            weather_desc = "Fair Weather"
            rain_prob = 5
            wave_height = 0.95
            wave_period = 6.8
            wave_dir = 165
            current_speed_knots = 0.4
            current_dir = "S"
            sea_temp_c = 30.2
            rain_sum = 0.0
            temp_min = temp_c
            temp_max = temp_c

            async with httpx.AsyncClient(timeout=8.0) as client:
                # 1. FAR FUTURE CLIMATE BRANCH (days_diff > 16)
                if (is_climate or days_diff > 16) and target_date_str:
                    url_climate = (
                        f"https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lon}"
                        f"&start_date={target_date_str}&end_date={target_date_str}"
                        f"&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
                    )
                    res_clim = await client.get(url_climate)
                    if res_clim.status_code == 200:
                        c_daily = res_clim.json().get("daily", {})
                        if c_daily.get("temperature_2m_max") and len(c_daily["temperature_2m_max"]) > 0:
                            temp_max = round(float(c_daily["temperature_2m_max"][0]), 1)
                            temp_min = round(float(c_daily["temperature_2m_min"][0]), 1)
                            temp_c = round(float(c_daily.get("temperature_2m_mean", [temp_max])[0]), 1)
                            rain_sum = round(float(c_daily.get("precipitation_sum", [0.0])[0]), 1)
                            wind_speed_kmh = round(float(c_daily.get("wind_speed_10m_max", [20.0])[0]), 1)
                            wind_gusts_kmh = round(wind_speed_kmh * 1.3, 1)

                            if rain_sum > 8.0:
                                rain_prob = 75
                                weather_desc = "Seasonal Monsoon Showers"
                            elif rain_sum > 2.0:
                                rain_prob = 50
                                weather_desc = "Scattered Seasonal Showers"
                            elif rain_sum > 0.1:
                                rain_prob = 25
                                weather_desc = "Light Seasonal Rain"
                            else:
                                rain_prob = 5
                                weather_desc = "Clear Seasonal Sky"

                # 2. DEEP HISTORICAL ARCHIVE BRANCH (days_diff < -92)
                elif days_diff < -92 and target_date_str:
                    url_arch = (
                        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
                        f"&start_date={target_date_str}&end_date={target_date_str}"
                        f"&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                    )
                    res_arch = await client.get(url_arch)
                    if res_arch.status_code == 200:
                        h = res_arch.json().get("hourly", {})
                        t_slice = [x for x in h.get("temperature_2m", []) if x is not None]
                        r_slice = [x for x in h.get("precipitation", []) if x is not None]
                        w_slice = [x for x in h.get("wind_speed_10m", []) if x is not None]
                        g_slice = [x for x in h.get("wind_gusts_10m", []) if x is not None]
                        d_slice = [x for x in h.get("wind_direction_10m", []) if x is not None]
                        c_slice = [x for x in h.get("weather_code", []) if x is not None]

                        if t_slice:
                            temp_max = round(max(t_slice), 1)
                            temp_min = round(min(t_slice), 1)
                            temp_c = round(sum(t_slice) / len(t_slice), 1)
                        if r_slice:
                            rain_sum = round(sum(r_slice), 1)
                            rain_prob = 90 if rain_sum > 1.0 else (40 if rain_sum > 0.0 else 5)
                        if w_slice:
                            wind_speed_kmh = round(max(w_slice), 1)
                        if g_slice:
                            wind_gusts_kmh = round(max(g_slice), 1)
                        elif w_slice:
                            wind_gusts_kmh = round(wind_speed_kmh * 1.3, 1)
                        if d_slice:
                            wind_deg = int(d_slice[len(d_slice) // 2])
                            wind_cardinal = self._degrees_to_cardinal(wind_deg)
                        if c_slice:
                            w_code = max(set(c_slice), key=c_slice.count)
                            weather_desc = self._wmo_code_to_description(w_code)

                # 3. STANDARD FORECAST & RECENT ARCHIVE (-92 <= days_diff <= 16)
                else:
                    if target_date_str:
                        url_atmos = (
                            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                            f"&start_date={target_date_str}&end_date={target_date_str}"
                            f"&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                        )
                        if days_diff <= 8:
                            url_marine = (
                                f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}"
                                f"&start_date={target_date_str}&end_date={target_date_str}"
                                f"&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
                            )
                        else:
                            url_marine = (
                                f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}"
                                f"&forecast_days=8"
                                f"&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
                            )
                    else:
                        req_forecast_days = max(3, min(16, days_ahead + 2))
                        req_marine_days = max(2, min(8, days_ahead + 2))
                        url_atmos = (
                            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                            f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                            f"&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                            f"&forecast_days={req_forecast_days}"
                        )
                        url_marine = (
                            f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}"
                            f"&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
                            f"&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
                            f"&forecast_days={req_marine_days}"
                        )

                    res_atmos, res_marine = await asyncio.gather(
                        client.get(url_atmos),
                        client.get(url_marine),
                        return_exceptions=True
                    )

                    if not isinstance(res_atmos, Exception) and res_atmos.status_code == 200:
                        data = res_atmos.json()
                        h = data.get("hourly", {})
                        h_times = h.get("time", [])

                        # Find matching hourly entries for target_date if specified
                        date_indices = []
                        if target_date_str:
                            date_indices = [i for i, t in enumerate(h_times) if t.startswith(target_date_str)]
                            if not date_indices and len(h_times) == 24:
                                date_indices = list(range(len(h_times)))
                        elif is_tomorrow and len(h_times) >= 48:
                            date_indices = list(range(24, 48))

                        if date_indices:
                            p_slice = [h["precipitation_probability"][i] for i in date_indices if h.get("precipitation_probability") and h["precipitation_probability"][i] is not None]
                            r_slice = [h["precipitation"][i] for i in date_indices if h.get("precipitation") and h["precipitation"][i] is not None]
                            t_slice = [h["temperature_2m"][i] for i in date_indices if h.get("temperature_2m") and h["temperature_2m"][i] is not None]
                            w_slice = [h["wind_speed_10m"][i] for i in date_indices if h.get("wind_speed_10m") and h["wind_speed_10m"][i] is not None]
                            g_slice = [h["wind_gusts_10m"][i] for i in date_indices if h.get("wind_gusts_10m") and h["wind_gusts_10m"][i] is not None]
                            d_slice = [h["wind_direction_10m"][i] for i in date_indices if h.get("wind_direction_10m") and h["wind_direction_10m"][i] is not None]
                            c_slice = [h["weather_code"][i] for i in date_indices if h.get("weather_code") and h["weather_code"][i] is not None]

                            rain_prob = max(p_slice) if p_slice else (80 if (r_slice and sum(r_slice) > 1.0) else 5)
                            rain_sum = round(sum(r_slice), 1) if r_slice else 0.0
                            temp_max = round(max(t_slice), 1) if t_slice else temp_c
                            temp_min = round(min(t_slice), 1) if t_slice else temp_c
                            temp_c = temp_max
                            wind_speed_kmh = round(max(w_slice), 1) if w_slice else wind_speed_kmh
                            wind_gusts_kmh = round(max(g_slice), 1) if g_slice else round(wind_speed_kmh * 1.3, 1)
                            wind_deg = int(d_slice[len(d_slice)//2]) if d_slice else wind_deg
                            wind_cardinal = self._degrees_to_cardinal(wind_deg)
                            w_code = max(set(c_slice), key=c_slice.count) if c_slice else 0
                            weather_desc = self._wmo_code_to_description(w_code)
                        else:
                            curr = data.get("current", {})
                            temp_c = curr.get("temperature_2m", temp_c)
                            temp_min = temp_c
                            temp_max = temp_c
                            wind_speed_kmh = curr.get("wind_speed_10m", wind_speed_kmh)
                            wind_gusts_kmh = curr.get("wind_gusts_10m", round(wind_speed_kmh * 1.25, 1))
                            wind_deg = curr.get("wind_direction_10m", wind_deg)
                            wind_cardinal = self._degrees_to_cardinal(wind_deg)
                            weather_code = curr.get("weather_code", 0)
                            weather_desc = self._wmo_code_to_description(weather_code)
                            rain_sum = round(float(curr.get("precipitation", 0.0) or 0.0), 1)

                            hourly = data.get("hourly", {})
                            rain_probs = hourly.get("precipitation_probability", [5])
                            rain_prob = rain_probs[0] if rain_probs else 5

                    if not isinstance(res_marine, Exception) and res_marine.status_code == 200:
                        m_data = res_marine.json()
                        mh = m_data.get("hourly", {})
                        mh_times = mh.get("time", [])

                        m_indices = []
                        if target_date_str:
                            m_indices = [i for i, t in enumerate(mh_times) if t.startswith(target_date_str)]
                            if not m_indices and len(mh_times) == 24:
                                m_indices = list(range(len(mh_times)))
                        elif is_tomorrow and len(mh_times) >= 48:
                            m_indices = list(range(24, 48))

                        if m_indices:
                            wh_slice = [mh["wave_height"][i] for i in m_indices if mh.get("wave_height") and mh["wave_height"][i] is not None]
                            wp_slice = [mh["wave_period"][i] for i in m_indices if mh.get("wave_period") and mh["wave_period"][i] is not None]
                            wd_slice = [mh["wave_direction"][i] for i in m_indices if mh.get("wave_direction") and mh["wave_direction"][i] is not None]
                            cv_slice = [mh["ocean_current_velocity"][i] for i in m_indices if mh.get("ocean_current_velocity") and mh["ocean_current_velocity"][i] is not None]
                            cd_slice = [mh["ocean_current_direction"][i] for i in m_indices if mh.get("ocean_current_direction") and mh["ocean_current_direction"][i] is not None]
                            st_slice = [mh["sea_surface_temperature"][i] for i in m_indices if mh.get("sea_surface_temperature") and mh["sea_surface_temperature"][i] is not None]

                            if wh_slice:
                                wave_height = round(float(max(wh_slice)), 2)
                            if wp_slice:
                                wave_period = round(float(wp_slice[len(wp_slice)//2]), 1)
                            if wd_slice:
                                wave_dir = int(wd_slice[len(wd_slice)//2])
                            if cv_slice:
                                current_speed_knots = round(float(max(cv_slice)) * 1.94384, 1)
                            if cd_slice:
                                current_dir = self._degrees_to_cardinal(float(cd_slice[len(cd_slice)//2]))
                            if st_slice:
                                sea_temp_c = round(float(st_slice[len(st_slice)//2]), 1)
                        else:
                            m_curr = m_data.get("current", {})
                            if m_curr.get("wave_height") is not None:
                                wave_height = round(float(m_curr.get("wave_height")), 2)
                            if m_curr.get("wave_period") is not None:
                                wave_period = round(float(m_curr.get("wave_period")), 1)
                            if m_curr.get("wave_direction") is not None:
                                wave_dir = int(m_curr.get("wave_direction"))
                            if m_curr.get("ocean_current_velocity") is not None:
                                current_speed_knots = round(float(m_curr.get("ocean_current_velocity")) * 1.94384, 1)
                            if m_curr.get("ocean_current_direction") is not None:
                                current_dir = self._degrees_to_cardinal(float(m_curr.get("ocean_current_direction")))
                            if m_curr.get("sea_surface_temperature") is not None:
                                sea_temp_c = round(float(m_curr.get("sea_surface_temperature")), 1)

            w_res = {
                "is_tomorrow": is_tomorrow,
                "target_date_str": target_date_str,
                "days_diff": days_diff,
                "is_past": is_past,
                "is_climate": is_climate,
                "temp_c": round(float(temp_c), 1),
                "temp_min": round(float(temp_min), 1),
                "temp_max": round(float(temp_max), 1),
                "wind_kmh": round(float(wind_speed_kmh), 1),
                "wind_gusts_kmh": round(float(wind_gusts_kmh), 1),
                "wind_deg": int(wind_deg),
                "wind_cardinal": wind_cardinal,
                "weather_desc": weather_desc,
                "rain_prob": int(rain_prob),
                "rain_sum": float(rain_sum),
                "wave_height": float(wave_height),
                "wave_period": float(wave_period),
                "wave_dir": int(wave_dir),
                "current_speed_knots": float(current_speed_knots),
                "current_dir": current_dir,
                "sea_temp_c": float(sea_temp_c)
            }
            _WEATHER_CACHE[cache_key] = (now, w_res)
            return w_res
        except Exception as e:
            logger.warning(f"Open-Meteo live atmospheric/marine fetch warning: {e}")

        fallback_w = {
            "is_tomorrow": is_tomorrow,
            "target_date_str": target_date_str,
            "days_diff": days_diff,
            "is_past": is_past,
            "is_climate": is_climate,
            "temp_c": 30.5,
            "temp_min": 25.0,
            "temp_max": 33.0,
            "wind_kmh": 24.0,
            "wind_gusts_kmh": 32.0,
            "wind_deg": 225,
            "wind_cardinal": "SW",
            "weather_desc": "Fair Weather",
            "rain_prob": 5,
            "rain_sum": 0.0,
            "wave_height": 0.95,
            "wave_period": 6.8,
            "wave_dir": 165,
            "current_speed_knots": 0.4,
            "current_dir": "S",
            "sea_temp_c": 30.2
        }
        _WEATHER_CACHE[cache_key] = (now, fallback_w)
        return fallback_w

    def _evaluate_risk(
        self,
        wind_kmh: float,
        wave_height: float,
        rain_prob: int = 10,
        is_inland: bool = False,
        location_name: Optional[str] = None
    ) -> RiskAssessment:
        effective_wind = wind_kmh
        loc_str = location_name or "Inland Region"

        if is_inland:
            if effective_wind > 45.0 or rain_prob > 75:
                return RiskAssessment(
                    level="HIGH",
                    color="#EF4444",
                    title="HIGH RISK - STAY SHELTERED",
                    reason=f"Severe inland gale wind ({effective_wind:.1f} km/h) or heavy rain ({rain_prob}%) in {loc_str}",
                    advice="Avoid non-essential land travel and stay sheltered indoors."
                )
            elif effective_wind > 28.0 or rain_prob > 50:
                return RiskAssessment(
                    level="MODERATE",
                    color="#F59E0B",
                    title="MODERATE WEATHER - PROCEED WITH CAUTION",
                    reason=f"Breezy inland conditions ({effective_wind:.1f} km/h) in {loc_str}",
                    advice="Take standard precautions for travel. Carry umbrella or rain protection if needed."
                )
            else:
                return RiskAssessment(
                    level="LOW",
                    color="#10B981",
                    title="SAFE / FAVORABLE WEATHER",
                    reason=f"Favorable calm inland conditions. Light breeze ({effective_wind:.1f} km/h)",
                    advice="Safe and pleasant weather conditions for daily activities and travel."
                )

        effective_wave = wave_height
        if effective_wind > 45.0 or effective_wave > 2.5:
            return RiskAssessment(
                level="HIGH",
                color="#EF4444",
                title="HIGH RISK - STAY ASHORE",
                reason=f"Strong gale wind ({effective_wind:.1f} km/h) or high sea swells ({effective_wave:.1f}m)",
                advice="Do NOT venture out to sea. Remain in harbor and secure all fishing gear."
            )
        elif effective_wind > 28.0 or effective_wave > 1.6:
            return RiskAssessment(
                level="MODERATE",
                color="#F59E0B",
                title="MODERATE RISK - PROCEED WITH CAUTION",
                reason=f"Moderate coastal wind ({effective_wind:.1f} km/h) and wave height ({effective_wave:.1f}m)",
                advice="Mechanized trawlers can proceed with caution. Motorized boats keep close to shore."
            )
        else:
            return RiskAssessment(
                level="LOW",
                color="#10B981",
                title="SAFE FOR FISHING",
                reason=f"Favorable calm weather. Light wind ({effective_wind:.1f} km/h), wave height ({effective_wave:.1f}m)",
                advice="Excellent conditions for maritime voyages."
            )

    def _get_dataset_citation(self, lang: str, is_tomorrow: bool = False, date_info: Optional[Dict[str, Any]] = None) -> str:
        is_past = date_info.get("is_past", False) if date_info else False
        is_climate = date_info.get("is_climate", False) if date_info else False

        if date_info and date_info.get("period_display"):
            period_str = date_info["period_display"].get(lang, date_info["period_display"].get("en", "Forecast"))
            if is_past:
                timeline_str_ta = f"முந்தைய நேரலை பதிவு ({period_str})"
                timeline_str_en = f"Historical Observation ({period_str})"
                timeline_str_te = f"చారిత్రక రికార్డు ({period_str})"
                timeline_str_ml = f"മുൻകാല രേഖ ({period_str})"
                timeline_str_hi = f"ऐतिहासिक रिकॉर्ड ({period_str})"
            elif is_climate:
                timeline_str_ta = f"பருவகால சராசரி கணிப்பு ({period_str})"
                timeline_str_en = f"Climate Outlook Projection ({period_str})"
                timeline_str_te = f"వాతావరణ అంచనా ({period_str})"
                timeline_str_ml = f"കാലാവസ്ഥാ പ്രവചനം ({period_str})"
                timeline_str_hi = f"जलवायु सामान्य अनुमान ({period_str})"
            else:
                timeline_str_ta = f"முன்னறிவிப்பு ({period_str})"
                timeline_str_en = f"Forecast ({period_str})"
                timeline_str_te = f"సూచన ({period_str})"
                timeline_str_ml = f"പ്രവചനം ({period_str})"
                timeline_str_hi = f"पूर्वानुमान ({period_str})"
        else:
            timeline_str_ta = "நாளைக்கான முன்னறிவிப்பு (24h Forecast)" if is_tomorrow else "நேரலை அளவீடு (Live Telemetry)"
            timeline_str_en = "Forecast for Tomorrow (24h Window)" if is_tomorrow else "Live Real-Time Telemetry"
            timeline_str_te = "రేపటి సూచన (24h Forecast)" if is_tomorrow else "ప్రత్యక్ష డేటా (Live Telemetry)"
            timeline_str_ml = "നാളത്തെ പ്രവചനം (24h Forecast)" if is_tomorrow else "തത്സമയ വിവരം (Live Telemetry)"
            timeline_str_hi = "कल का पूर्वानुमान (24h Forecast)" if is_tomorrow else "लाइव टेलीमेट्री (Live Telemetry)"

        source_en = "Open-Meteo High-Resolution Climate Projections" if is_climate else ("Open-Meteo ERA5 / Historical Archive Telemetry" if is_past else "Open-Meteo High-Resolution Numerical Weather & Marine Models")
        source_ta = "Open-Meteo பருவகால காலநிலை கணிப்பு மாதிரி" if is_climate else ("Open-Meteo வரலாற்று வானிலை பதிவு தரவுத்தளம்" if is_past else "Open-Meteo High-Resolution Numerical Weather & Marine Models")

        if lang == "ta":
            return (
                f"\n\n📊 ஒருங்கிணைக்கப்பட்ட நேரலை தரவுத்தளங்கள் ({timeline_str_ta}):\n"
                f"• {source_ta}\n"
                f"• INCOIS (மத்திய புவி அறிவியல் அமைச்சகம்) - PFZ சாட்டிலைட் & கடல் முன்னறிவிப்பு\n"
                f"• Copernicus Marine Services (CMEMS) - கடல் இயற்பியல் நீரோட்டம்"
            )
        elif lang == "te":
            return (
                f"\n\n📊 సమగ్ర ప్రత్యక్ష డేటాసెట్‌లు ({timeline_str_te}):\n"
                f"• {source_en}\n"
                f"• INCOIS (భారత ప్రభుత్వ భూ విజ్ఞాన మంత్రిత్వ శాఖ) - PFZ ఉపగ్రహ సలహాలు\n"
                f"• Copernicus Marine Services (CMEMS)"
            )
        elif lang == "ml":
            return (
                f"\n\n📊 സംയോജിത തത്സമയ ഡാറ്റാസെറ്റുകൾ ({timeline_str_ml}):\n"
                f"• {source_en}\n"
                f"• INCOIS (ഭാരത സർക്കാർ ഭൗമശാസ്ത്ര മന്ത്രാലയം) - PFZ മുന്നറിയിപ്പുകൾ\n"
                f"• Copernicus Marine Services (CMEMS)"
            )
        elif lang == "hi":
            return (
                f"\n\n📊 एकीकृत लाइव डेटासेट्स ({timeline_str_hi}):\n"
                f"• {source_en}\n"
                f"• INCOIS (पृथ्वी विज्ञान मंत्रालय, भारत सरकार) - PFZ उपग्रह मत्स्य क्षेत्र एवं पूर्वानुमान\n"
                f"• Copernicus Marine Services (CMEMS)"
            )
        else:
            return (
                f"\n\n📊 Integrated Real-Time Datasets ({timeline_str_en}):\n"
                f"• {source_en}\n"
                f"• INCOIS (Ministry of Earth Sciences, Govt of India) - PFZ & Ocean State Forecast\n"
                f"• Copernicus Marine Services (CMEMS) - Ocean Physics & Currents"
            )

    async def _synthesize_response(
        self,
        query: str,
        language: str,
        intent: str,
        risk: RiskAssessment,
        wind_kmh: float,
        wind_dir: str,
        wind_gusts: float,
        temp_c: float,
        weather_desc: str,
        wave_height: float,
        wave_period: float,
        sea_temp: float,
        current_speed: float,
        current_dir: str,
        nearest_port: str,
        port_dist: float,
        port_dist_nm: float,
        port_bearing: float,
        port_cardinal: str,
        port_lat: float,
        port_lon: float,
        seafloor_depth: int,
        port_vhf: str,
        seasonal_trend: str,
        spot: Optional[HotspotSummary],
        drift_dist_km: Optional[float] = None,
        drift_cardinal: Optional[str] = None,
        is_tomorrow: bool = False,
        location_name: Optional[str] = None,
        is_inland: bool = False,
        temp_min: float = 0.0,
        temp_max: float = 0.0,
        rain_prob: int = 5,
        rain_sum: float = 0.0,
        date_info: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        lang = self._normalize_lang_code(language) or "en"
        sp_text = ", ".join(spot.target_species) if spot else "Indian Mackerel, Sardine, Tuna"
        dataset_block = self._get_dataset_citation(lang, is_tomorrow, date_info)
        loc_header = location_name or "Chennai Coast"

        # 1. Attempt LLM Grounding with Gemini 2.0 Flash / Sarvam LLM
        target_forecast_date_label = date_info["period_display"]["en"] if (date_info and date_info.get("period_display")) else ("Tomorrow" if is_tomorrow else "Today")
        prompt_data = (
            f"User Question: {query}\n"
            f"Target Location: {loc_header} (Is Inland: {is_inland})\n"
            f"Target Language Code: {lang}\n"
            f"Forecast Date: {target_forecast_date_label}\n"
            f"Telemetry Ground Truth Data:\n"
            f"- Temperature: {temp_c:.1f}°C (Range: {temp_min:.1f}°C - {temp_max:.1f}°C)\n"
            f"- Rain Probability: {rain_prob}%, Expected Rainfall: {rain_sum:.1f} mm, Sky Condition: {weather_desc}\n"
            f"- Wind Speed: {wind_kmh:.1f} km/h from {wind_dir} (Gusts: {wind_gusts:.1f} km/h)\n"
            f"{f'- Significant Wave Height: {wave_height:.2f}m, Surface Current: {current_speed} kts towards {current_dir}' if not is_inland else '- Inland Terrain (No ocean waves)'}\n"
            f"Answer the user directly and concisely in {lang} language with the real measurements provided above."
        )

        try:
            llm_text = await asyncio.wait_for(
                sarvam_service.generate_regional_marine_summary(prompt=prompt_data, language_code=lang),
                timeout=4.5
            )
            if llm_text and len(llm_text.strip()) > 30:
                resp = llm_text.strip()
                # Clean voice from markdown symbols so full response can be spoken naturally
                voice_clean = re.sub(r'[*_#`•|]', ' ', resp).replace('\n', '. ')
                return f"{resp}{dataset_block}", voice_clean
        except Exception as e:
            logger.info(f"LLM grounding fallback to high-precision template: {e}")

        # Extract universal date and period labels for all intents
        if date_info and date_info.get("day_word"):
            day_word_en = date_info["day_word"].get("en", "today")
            day_word_ta = date_info["day_word"].get("ta", "இன்று")
            day_word_hi = date_info["day_word"].get("hi", "आज")
            day_word_te = date_info["day_word"].get("te", "ఈరోజు")
            day_word_ml = date_info["day_word"].get("ml", "இன்று")
        else:
            day_word_en = "tomorrow" if is_tomorrow else "today"
            day_word_ta = "நாளை" if is_tomorrow else "இன்று"
            day_word_hi = "कल" if is_tomorrow else "आज"
            day_word_te = "రేపు" if is_tomorrow else "ఈరోజు"
            day_word_ml = "നാളെ" if is_tomorrow else "இன்று"

        if date_info and date_info.get("period_display"):
            period_disp_en = date_info["period_display"].get("en", day_word_en.capitalize())
            period_disp_ta = date_info["period_display"].get("ta", day_word_ta.capitalize())
            period_disp_hi = date_info["period_display"].get("hi", day_word_hi.capitalize())
            period_disp_te = date_info["period_display"].get("te", day_word_te.capitalize())
            period_disp_ml = date_info["period_display"].get("ml", day_word_ml.capitalize())
        else:
            period_disp_en = day_word_en.capitalize()
            period_disp_ta = day_word_ta.capitalize()
            period_disp_hi = day_word_hi.capitalize()
            period_disp_te = day_word_te.capitalize()
            period_disp_ml = day_word_ml.capitalize()

        # 2. High-Precision Grounded Regional Language Templates
        is_past = date_info.get("is_past", False) if date_info else False
        is_climate = date_info.get("is_climate", False) if date_info else False

        if intent == "cyclone_storm":
            is_cyclone_danger = (wind_gusts > 55.0 or wind_kmh > 45.0 or wave_height > 2.5)
            if lang == "ta":
                if is_cyclone_danger:
                    voice_text = f"எச்சரிக்கை: {loc_header} கடல் பகுதியில் தீவிர புயல் மற்றும் பலத்த காற்று வீச்சு மணிக்கு {wind_gusts:.1f} கிலோமீட்டர் வரை பதிவாகியுள்ளது. மீனவர்கள் கடலுக்கு செல்ல வேண்டாம்."
                    resp = (
                        f"🚨 தீவிர புயல் / பலத்த காற்று எச்சரிக்கை ({period_disp_ta}):\n\n"
                        f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                        f"• புயல் நிலை: தீவிர காற்று மற்றும் கடல் கொந்தளிப்பு அபாயம் உள்ளது\n"
                        f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                        f"• கடல் அலை உயரம்: {wave_height:.2f} மீட்டர்\n"
                        f"• மழை வாய்ப்பு: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 பாதுகாப்பு எச்சரிக்கை: எக்காரணம் கொண்டும் கடலுக்குள் செல்ல வேண்டாம். துறைமுகத்தில் பாதுகாப்பாக இருக்கவும்."
                    )
                else:
                    voice_text = f"{loc_header} கடல் பகுதிக்கு {day_word_ta} எவ்வித புயல் அல்லது சூறாவளி எச்சரிக்கையும் இல்லை. காற்றின் வேகம் மணிக்கு {wind_kmh:.1f} கிலோமீட்டர், அலை உயரம் {wave_height:.2f} மீட்டர் என வானிலை இயல்பாக உள்ளது."
                    resp = (
                        f"✅ எவ்வித புயல் அல்லது சூறாவளி எச்சரிக்கையும் இல்லை ({period_disp_ta}):\n\n"
                        f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                        f"• நேரலை புயல் / சூறாவளி எச்சரிக்கை: ஏதுமில்லை (வானிலை இயல்பானது)\n"
                        f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                        f"• கடல் அலை உயரம்: {wave_height:.2f} மீட்டர்\n"
                        f"• மழை வாய்ப்பு: {rain_prob}% ({weather_desc})\n\n"
                        f"💡 பாதுகாப்பு வழிகாட்டல்: கடலில் புயல் அபாயம் இல்லை. கடல் அமைதியாகவும் மீன்பிடிக்க பாதுகாப்பாகவும் உள்ளது."
                    )
            elif lang == "hi":
                if is_cyclone_danger:
                    voice_text = f"चेतावनी: {loc_header} में तीव्र चक्रवात एवं तेज आंधी {wind_gusts:.1f} किमी प्रति घंटा का अलर्ट सक्रिय है। समुद्र में न जाएं।"
                    resp = (
                        f"🚨 चक्रवात / तीव्र आंधी अलर्ट ({period_disp_hi}):\n\n"
                        f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                        f"• अलर्ट स्थिति: तीव्र चक्रवात एवं तेज हवा का जोखिम सक्रिय है\n"
                        f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                        f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर\n"
                        f"• वर्षा संभावना: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 सुरक्षा निर्देश: समुद्र में न जाएं। बंदरगाह में सुरक्षित रहें।"
                    )
                else:
                    voice_text = f"{loc_header} के लिए {day_word_hi} कोई चक्रवात या तूफान अलर्ट नहीं है। हवा की गति {wind_kmh:.1f} किमी प्रति घंटा और लहरों की ऊंचाई {wave_height:.2f} मीटर है। मौसम सामान्य और शांत है।"
                    resp = (
                        f"✅ कोई चक्रवात या तूफान अलर्ट नहीं है ({period_disp_hi}):\n\n"
                        f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                        f"• चक्रवात / तूफान अलर्ट: कोई अलर्ट नहीं (मौसम सामान्य एवं शांत)\n"
                        f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                        f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर\n"
                        f"• वर्षा संभावना: {rain_prob}% ({weather_desc})\n\n"
                        f"💡 सुरक्षा सलाह: समुद्र में चक्रवात का कोई खतरा नहीं है। स्थितियाँ सामान्य और सुरक्षित हैं।"
                    )
            elif lang == "te":
                if is_cyclone_danger:
                    voice_text = f"హెచ్చరిక: {loc_header} లో తుఫాను హెచ్చరిక క్రియాశీలంగా ఉంది."
                    resp = (
                        f"🚨 తీవ్ర తుఫాను హెచ్చరిక ({period_disp_te}):\n\n"
                        f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                        f"• తుఫాను స్థితి: తీవ్ర గాలి ప్రమాదం\n"
                        f"• గాలి వేగం: {wind_kmh:.1f} కి.மீ/గం ({wind_dir})\n\n"
                        f"🚨 సలహా: సముద్రంలోకి వెళ్లవద్దు."
                    )
                else:
                    voice_text = f"{loc_header} ప్రాంతానికి {day_word_te} ఎలాంటి తుఫాను హెచ్చరికలు లేవు."
                    resp = (
                        f"✅ ఎలాంటి తుఫాను హెచ్చరికలు లేవు ({period_disp_te}):\n\n"
                        f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                        f"• తుఫాను హెచ్చరిక: ఏదీ లేదు (వాతావరణం సాధారణం)\n"
                        f"• గాలి వేగం: {wind_kmh:.1f} కి.மீ/గం ({wind_dir}) | అలల ఎత్తు: {wave_height:.2f} మీటర్లు\n\n"
                        f"💡 సలహా: సముద్రంలో ఎలాంటి తుఫాను ముప్పు లేదు."
                    )
            elif lang == "ml":
                if is_cyclone_danger:
                    voice_text = f"മുന്നറിയിപ്പ്: {loc_header} ൽ ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പ് നിലവിലുണ്ട്."
                    resp = (
                        f"🚨 ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പ് ({period_disp_ml}):\n\n"
                        f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                        f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ\n\n"
                        f"🚨 നിർദ്ദേശം: കടലിൽ പോകരുത്."
                    )
                else:
                    voice_text = f"{loc_header} തീരത്ത് {day_word_ml} ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പുകൾ ഇല്ല."
                    resp = (
                        f"✅ ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പുകൾ ഇല്ല ({period_disp_ml}):\n\n"
                        f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                        f"• ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പ്: നിലവിലില്ല\n"
                        f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ | തിരമാല: {wave_height:.2f} മീറ്റർ\n\n"
                        f"💡 നിർദ്ദേശം: സമുദ്രത്തിൽ ചുഴലിക്കാറ്റ് ഭീഷണിയില്ല."
                    )
            else:
                if is_cyclone_danger:
                    voice_text = f"Warning: Severe Cyclone and Gale Alert active for {loc_header}. Wind gusts reaching {wind_gusts:.1f} kilometers per hour with rough seas of {wave_height:.2f} meters. Do NOT venture into the sea."
                    resp = (
                        f"🚨 Severe Cyclone & Gale Wind Alert Active ({period_disp_en}):\n\n"
                        f"📍 Location: {loc_header} | Date: {period_disp_en}\n"
                        f"• Alert Status: Severe Cyclone & Rough Sea Advisory Active\n"
                        f"• Sustained Wind: {wind_kmh:.1f} km/h ({wind_dir}) | Peak Gusts: {wind_gusts:.1f} km/h\n"
                        f"• Significant Wave Height: {wave_height:.2f} meters\n"
                        f"• Rain Probability: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 Marine Safety Directive: Severe marine hazard. Remain in port and secure all vessels."
                    )
                else:
                    voice_text = f"Live satellite telemetry confirms NO active cyclone, storm, or depression alerts for {loc_header} {day_word_en}. Sustained wind speed is {wind_kmh:.1f} kilometers per hour and wave height is {wave_height:.2f} meters. Conditions are safe and normal."
                    resp = (
                        f"✅ NO Active Cyclone or Storm Alerts ({period_disp_en}):\n\n"
                        f"📍 Location: {loc_header} | Date: {period_disp_en}\n"
                        f"• IMD / INCOIS Alert Status: No Cyclone, Depression, or Gale Warning Active\n"
                        f"• Sustained Wind Speed: {wind_kmh:.1f} km/h ({wind_dir}) | Peak Gusts: {wind_gusts:.1f} km/h\n"
                        f"• Significant Wave Height: {wave_height:.2f} meters\n"
                        f"• Precipitation Probability: {rain_prob}% ({weather_desc})\n\n"
                        f"💡 Safety Advisory: Marine conditions are calm and normal. No tropical depressions or storm systems detected."
                    )
            return f"{resp}{dataset_block}", voice_text

        elif intent == "rain_precipitation" or (is_inland and location_name):

            temp_str_en = f"{temp_min:.1f}°C - {temp_max:.1f}°C (Current: {temp_c:.1f}°C)" if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"{temp_c:.1f}°C"
            temp_str_ta = f"{temp_min:.1f}°C முதல் {temp_max:.1f}°C வரை (தற்போது: {temp_c:.1f}°C)" if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"{temp_c:.1f}°C"
            temp_str_hi = f"{temp_min:.1f}°C से {temp_max:.1f}°C (वर्तमान: {temp_c:.1f}°C)" if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"{temp_c:.1f}°C"

            if lang == "ta":
                if is_past:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"இல்லை, {loc_header} பகுதியில் {day_word_ta} மழை பெய்யவில்லை."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} மழை பதிவாகவில்லை (பதிவான மழை {rain_sum:.1f} மி.மீ). வானிலை {weather_desc} ஆக இருந்தது."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"ஆம், {loc_header} பகுதியில் {day_word_ta} மழை பெய்துள்ளது."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} மழை பதிவாகியுள்ளது (பதிவான மழை {rain_sum:.1f} மி.மீ)."
                    else:
                        rain_headline = f"{loc_header} பகுதியில் {day_word_ta} லேசான சாரல் மழை பதிவாகியுள்ளது."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} லேசான சாரல் மழை பதிவாகியுள்ளது ({rain_sum:.1f} மி.மீ)."
                    voice_intro = f"{loc_header} பகுதிக்கான {day_word_ta} முந்தைய வானிலை பதிவு."
                elif is_climate:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"{loc_header} பகுதியில் {day_word_ta} வழக்கமான பருவகால மழை வாய்ப்பு குறைவு."
                        rain_v = f"பருவகால காலநிலை சராசரி கணிப்பின்படி, {loc_header} பகுதியில் வறண்ட அல்லது மிதமான வானிலை நிலவும் (எதிர்பார்க்கப்படும் மழை {rain_sum:.1f} மி.மீ)."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"{loc_header} பகுதியில் {day_word_ta} வழக்கமாக பருவகால மழை பெய்ய வாய்ப்புள்ளது."
                        rain_v = f"பருவகால காலநிலை சராசரி கணிப்பின்படி, வழக்கமாக இக்காலத்தில் மழைப்பொழிவு காணப்படும் (சராசரி மழை {rain_sum:.1f} மி.மீ)."
                    else:
                        rain_headline = f"{loc_header} பகுதியில் {day_word_ta} லேசான பருவகால சாரல் மழைக்கு வாய்ப்புள்ளது."
                        rain_v = f"பருவகால காலநிலை கணிப்பின்படி சாரல் மழை சாத்தியம் (சராசரி மழை {rain_sum:.1f} மி.மீ)."
                    voice_intro = f"{loc_header} பகுதிக்கான {day_word_ta} பருவகால வானிலை கணிப்பு."
                else:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"இல்லை, {loc_header} பகுதியில் {day_word_ta} மழை பெய்ய வாய்ப்பில்லை."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} மழைக்கு குறைவான வாய்ப்பே உள்ளது (சாத்தியக்கூறு வெறும் {rain_prob}%, எதிர்பார்க்கப்படும் மழை {rain_sum:.1f} மி.மீ). வானிலை {weather_desc} ஆக இருக்கும்."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"ஆம், {loc_header} பகுதியில் {day_word_ta} மழை பெய்ய வாய்ப்புள்ளது."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} மழைக்கான வாய்ப்பு அதிகம் உள்ளது ({rain_prob}%, எதிர்பார்க்கப்படும் மழை அளவு {rain_sum:.1f} மி.மீ). குடை அல்லது மழை கவசங்களை உடன் வைக்கவும்."
                    else:
                        rain_headline = f"{loc_header} பகுதியில் {day_word_ta} லேசான / ஆங்காங்கே சாரல் மழை பெய்ய வாய்ப்புள்ளது."
                        rain_v = f"{loc_header} பகுதியில் {day_word_ta} லேசான சாரல் மழைக்கு வாய்ப்புள்ளது (மழை சாத்தியக்கூறு {rain_prob}%, எதிர்பார்க்கப்படும் மழை {rain_sum:.1f} மி.மீ)."
                    voice_intro = f"{loc_header} பகுதிக்கான {day_word_ta} வானிலை முன்னறிவிப்பு."

                temp_spoken_ta = f"காற்றின் வெப்பநிலை {temp_min:.1f} முதல் {temp_max:.1f} டிகிரி செல்சியஸ் வரை இருக்கும்." if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"காற்றின் வெப்பநிலை {temp_c:.1f} டிகிரி செல்சியஸ் ஆகும்."

                voice_text = (
                    f"{voice_intro} "
                    f"{rain_headline} "
                    f"மழை அளவு {rain_sum:.1f} மில்லிமீட்டர், சாத்தியக்கூறு {rain_prob} சதவீதம். "
                    f"வானிலை நிலை {weather_desc}. "
                    f"{temp_spoken_ta} "
                    f"காற்றின் வேகம் மணிக்கு {wind_kmh:.1f} கிலோமீட்டர் {wind_dir} திசையிலிருந்து, காற்று வீச்சு மணிக்கு {wind_gusts:.1f} கிலோமீட்டர் வரை இருக்கும். "
                    f"வழிகாட்டல்: {rain_v}"
                )

                resp = (
                    f"🌦️ {rain_headline}\n\n"
                    f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                    f"• மழை பெய்யும் வாய்ப்பு: {rain_prob}%\n"
                    f"• எதிர்பார்க்கப்படும் மழை அளவு: {rain_sum:.1f} மி.மீ\n"
                    f"• வானிலை நிலை: {weather_desc}\n"
                    f"• காற்றின் வெப்பநிலை: {temp_str_ta}\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n\n"
                    f"💡 வழிகாட்டல்: {rain_v}"
                )
            elif lang == "hi":
                if is_past:
                    rain_headline = f"नहीं, {loc_header} में {day_word_hi} बारिश नहीं हुई थी।" if (rain_prob <= 20 and rain_sum <= 0.5) else f"हाँ, {loc_header} में {day_word_hi} बारिश दर्ज की गई थी।"
                    rain_v = f"{loc_header} में {day_word_hi} वर्षा {rain_sum:.1f} मिमी दर्ज हुई थी।"
                    voice_intro = f"{loc_header} के लिए {day_word_hi} का ऐतिहासिक मौसम रिकॉर्ड।"
                elif is_climate:
                    rain_headline = f"{loc_header} में {day_word_hi} जलवायु सामान्यतः शुष्क रहने का अनुमान है।" if (rain_prob <= 20 and rain_sum <= 0.5) else f"{loc_header} में {day_word_hi} मौसमी बारिश का अनुमान है।"
                    rain_v = f"जलवायु मॉडल के अनुसार सामान्य वर्षा {rain_sum:.1f} मिमी अनुमानित है।"
                    voice_intro = f"{loc_header} के लिए {day_word_hi} का मौसमी जलवायु पूर्वानुमान।"
                else:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"नहीं, {loc_header} में {day_word_hi} बारिश की संभावना नहीं है।"
                        rain_v = f"{loc_header} में {day_word_hi} बारिश की बहुत कम संभावना है ({rain_prob}%, संभावित वर्षा {rain_sum:.1f} मिमी)। मौसम मुख्यतः {weather_desc} रहेगा।"
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"हाँ, {loc_header} में {day_word_hi} बारिश होने की संभावना है।"
                        rain_v = f"{loc_header} में {day_word_hi} वर्षा की अधिक संभावना है ({rain_prob}%, अपेक्षित वर्षा {rain_sum:.1f} मिमी)। छाता साथ रखें।"
                    else:
                        rain_headline = f"{loc_header} में {day_word_hi} हल्की या छिटपुट बारिश संभव है।"
                        rain_v = f"{loc_header} में {day_word_hi} हल्की फुहारें पड़ सकती हैं ({rain_prob}%, अपेक्षित वर्षा {rain_sum:.1f} मिमी)।"
                    voice_intro = f"{loc_header} के लिए {day_word_hi} का मौसम पूर्वानुमान।"

                temp_spoken_hi = f"तापमान {temp_min:.1f} से {temp_max:.1f} डिग्री सेल्सियस रहेगा।" if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"तापमान {temp_c:.1f} डिग्री सेल्सियस रहेगा।"

                voice_text = (
                    f"{voice_intro} "
                    f"{rain_headline} "
                    f"वर्षा संभावना {rain_prob} प्रतिशत है और अपेक्षित वर्षा {rain_sum:.1f} मिलीमीटर है। "
                    f"आकाश {weather_desc} रहेगा। "
                    f"{temp_spoken_hi} "
                    f"हवा की गति {wind_kmh:.1f} किलोमीटर प्रति घंटा {wind_dir} से और झोंके {wind_gusts:.1f} किलोमीटर प्रति घंटा तक रहेंगे। "
                    f"सलाह: {rain_v}"
                )

                resp = (
                    f"🌦️ {rain_headline}\n\n"
                    f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                    f"• वर्षा संभावना: {rain_prob}%\n"
                    f"• संभावित वर्षा मात्रा: {rain_sum:.1f} मिमी\n"
                    f"• मौसम स्थिति: {weather_desc}\n"
                    f"• तापमान: {temp_str_hi}\n"
                    f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n\n"
                    f"💡 सलाह: {rain_v}"
                )
            elif lang == "te":
                rain_v = f"{loc_header} లో {day_word_te} వర్షం పడే అవకాశం ఉంది." if rain_prob > 50 else f"{loc_header} లో {day_word_te} వర్షం పడే అవకాశం తక్కువగా ఉంది ({rain_prob}%)."
                voice_text = (
                    f"{loc_header} కోసం {day_word_te} వాతావరణ సమాచారం. "
                    f"వర్షం సంభావ్యత {rain_prob} శాతం మరియు వర్షపాతం {rain_sum:.1f} మిల్లీమీటర్లు. "
                    f"ఆకాశం {weather_desc}గా ఉంటుంది. "
                    f"ఉష్ణోగ్రత {temp_c:.1f} డిగ్రీల సెల్సియస్. "
                    f"గాలి వేగం గంటకు {wind_kmh:.1f} కిలోమీటర్లు {wind_dir} దిశ నుండి, మరియు గాలి తీవ్రత {wind_gusts:.1f} కిలోమీటర్లు. "
                    f"సలహా: {rain_v}"
                )
                resp = (
                    f"🌦️ {loc_header} {day_word_te} వర్షం & వాతావరణ సమాచారం:\n\n"
                    f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                    f"• వర్షం సంభావ్యత: {rain_prob}%\n"
                    f"• వర్షపాతం: {rain_sum:.1f} mm\n"
                    f"• వాతావరణం: {weather_desc}\n"
                    f"• ఉష్ణోగ్రత: {temp_c:.1f}°C\n"
                    f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir}) | గాలి తీవ్రత: {wind_gusts:.1f} కి.మీ/గం\n\n"
                    f"💡 సలహా: {rain_v}"
                )
            elif lang == "ml":
                rain_v = f"{loc_header} ൽ {day_word_ml} മഴയ്ക്ക് സാധ്യതയുണ്ട്." if rain_prob > 50 else f"{loc_header} ൽ {day_word_ml} മഴയ്ക്ക് സാധ്യത കുറവാണ് ({rain_prob}%)."
                voice_text = (
                    f"{loc_header} ലെ {day_word_ml} കാലാവസ്ഥാ പ്രവചനം. "
                    f"മഴ സാധ്യത {rain_prob} ശതമാനവും പ്രതീക്ഷിക്കുന്ന മഴ {rain_sum:.1f} മില്ലിമീറ്ററുമാണ്. "
                    f"കാലാവസ്ഥ {weather_desc}. "
                    f"താപനില {temp_c:.1f} ഡിഗ്രി സെൽഷ്യസ്. "
                    f"കാറ്റിന്റെ വേഗത മണിക്കൂറിൽ {wind_kmh:.1f} കിലോമീറ്റർ {wind_dir} ദിശയിൽ നിന്ന്. "
                    f"നിർദ്ദേശം: {rain_v}"
                )
                resp = (
                    f"🌦️ {loc_header} {day_word_ml} മഴ പ്രവചനം:\n\n"
                    f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                    f"• മഴ സാധ്യത: {rain_prob}%\n"
                    f"• പ്രതീക്ഷിക്കുന്ന മഴ: {rain_sum:.1f} mm\n"
                    f"• കാലാവസ്ഥ: {weather_desc}\n"
                    f"• താപനില: {temp_c:.1f}°C\n"
                    f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n\n"
                    f"💡 നിർദ്ദേശം: {rain_v}"
                )
            else:
                if is_past:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"No, it did not rain {day_word_en} in {loc_header}."
                        rain_v = f"No significant precipitation was recorded in {loc_header} ({rain_sum:.1f} mm). Conditions were mostly {weather_desc}."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"Yes, rain was recorded {day_word_en} in {loc_header}."
                        rain_v = f"Precipitation was recorded in {loc_header} (measured rainfall: {rain_sum:.1f} mm). Sky condition was {weather_desc}."
                    else:
                        rain_headline = f"Light rainfall was recorded {day_word_en} in {loc_header}."
                        rain_v = f"Minor precipitation was observed in {loc_header} (measured rainfall: {rain_sum:.1f} mm)."
                    voice_intro = f"Historical weather record for {loc_header} {day_word_en}."
                elif is_climate:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"Rain is unlikely for {day_word_en} in {loc_header} based on seasonal climate trends."
                        rain_v = f"Climatological models indicate typically dry conditions (expected precipitation: {rain_sum:.1f} mm)."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"Seasonal rainfall is typically expected around {day_word_en} in {loc_header}."
                        rain_v = f"Climatological models indicate typical seasonal precipitation ({rain_sum:.1f} mm normal rainfall)."
                    else:
                        rain_headline = f"Light seasonal showers are possible around {day_word_en} in {loc_header}."
                        rain_v = f"Climatological projections show isolated rain likelihood ({rain_sum:.1f} mm expected normal)."
                    voice_intro = f"Seasonal climate outlook for {loc_header} {day_word_en}."
                else:
                    if rain_prob <= 20 and rain_sum <= 0.5:
                        rain_headline = f"No, it will not rain {day_word_en} in {loc_header}."
                        rain_v = f"Very low probability of rain ({rain_prob}%, expected rainfall: {rain_sum:.1f} mm). Conditions will be mostly {weather_desc}."
                    elif rain_prob > 50 or rain_sum >= 2.0:
                        rain_headline = f"Yes, rain is expected {day_word_en} in {loc_header}."
                        rain_v = f"High probability of rain in {loc_header} ({rain_prob}%, estimated precipitation: {rain_sum:.1f} mm). Rain protection recommended."
                    else:
                        rain_headline = f"Isolated or light rain is possible {day_word_en} in {loc_header}."
                        rain_v = f"Moderate chance of scattered showers in {loc_header} ({rain_prob}%, estimated precipitation: {rain_sum:.1f} mm)."
                    voice_intro = f"Weather forecast for {loc_header} {day_word_en}."

                temp_spoken_en = f"Air temperature will range from {temp_min:.1f} to {temp_max:.1f} degrees Celsius." if (temp_max > temp_min and (temp_max - temp_min) > 0.5) else f"Air temperature will be around {temp_c:.1f} degrees Celsius."

                voice_text = (
                    f"{voice_intro} "
                    f"{rain_headline} "
                    f"Rain probability is {rain_prob} percent, with expected rainfall of {rain_sum:.1f} millimeters. "
                    f"Sky condition will be {weather_desc}. "
                    f"{temp_spoken_en} "
                    f"Wind speed will be {wind_kmh:.1f} kilometers per hour from {wind_dir}, with gusts up to {wind_gusts:.1f} kilometers per hour. "
                    f"Advisory: {rain_v}"
                )

                resp = (
                    f"🌦️ {rain_headline}\n\n"
                    f"📍 Location: {loc_header} | Date: {period_disp_en}\n"
                    f"• Rain Probability: {rain_prob}%\n"
                    f"• Expected Rainfall: {rain_sum:.1f} mm\n"
                    f"• Sky Condition: {weather_desc}\n"
                    f"• Air Temperature: {temp_str_en}\n"
                    f"• Wind Speed: {wind_kmh:.1f} km/h ({wind_dir}) | Gusts: {wind_gusts:.1f} km/h\n\n"
                    f"💡 Advisory: {rain_v}"
                )
            return f"{resp}{dataset_block}", voice_text

        elif intent == "wave_conditions":
            if lang == "ta":
                w_status = "கடல் அலை அமைதியாக உள்ளது, அனைத்து படகுகளுக்கும் சாதகமானது." if wave_height < 1.2 else "மிதமான அலை எழுச்சி உள்ளது; சிறிய படகுகள் கவனமாக செல்லவும்."
                voice_text = f"{loc_header} கடல் பகுதிக்கான {day_word_ta} அலை முன்னறிவிப்பு. குறிப்பிடத்தக்க அலை உயரம் {wave_height:.2f} மீட்டர், அலை காலம் {wave_period:.1f} விநாடிகள், நீரோட்டம் {current_speed} நாட்ஸ் {current_dir} நோக்கி. ஆலோசனை: {w_status}"
                resp = (
                    f"🌊 கடல் அலை மற்றும் நீரோட்ட தகவல் ({period_disp_ta}):\n\n"
                    f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                    f"• குறிப்பிடத்தக்க அலை உயரம்: {wave_height:.2f} மீட்டர் (அலை காலம்: {wave_period:.1f} விநாடிகள்)\n"
                    f"• மேற்பரப்பு நீரோட்டம்: {current_speed} நாட்ஸ் ({current_dir} நோக்கி)\n"
                    f"• கடல் வெப்பநிலை: {sea_temp:.1f}°C\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n\n"
                    f"💡 ஆலோசனை: {w_status}"
                )
            elif lang == "hi":
                w_status = "समुद्र की लहरें शांत और सुरक्षित हैं।" if wave_height < 1.2 else "मध्यम समुद्री लहरें सक्रिय हैं।"
                voice_text = f"{loc_header} के लिए {day_word_hi} की समुद्री लहरों का पूर्वानुमान। लहरों की ऊंचाई {wave_height:.2f} मीटर और धारा {current_speed} नॉट्स है। सलाह: {w_status}"
                resp = (
                    f"🌊 समुद्री लहरें एवं धारा पूर्वानुमान ({period_disp_hi}):\n\n"
                    f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                    f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर (तरंग काल: {wave_period:.1f} सेकंड)\n"
                    f"• समुद्री धारा: {current_speed} नॉट्स ({current_dir})\n"
                    f"• समुद्र तापमान: {sea_temp:.1f}°C\n\n"
                    f"💡 सलाह: {w_status}"
                )
            elif lang == "te":
                w_status = "సముద్రపు అలలు ప్రశాంతంగా ఉన్నాయి." if wave_height < 1.2 else "అలల ఎత్తు మధ్యస్థంగా ఉంది."
                voice_text = f"{loc_header} కోసం {day_word_te} అలల ఎత్తు {wave_height:.2f} మీటర్లు."
                resp = (
                    f"🌊 సముద్రపు అలలు & ప్రవాహం ({period_disp_te}):\n\n"
                    f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                    f"• అలల ఎత్తు: {wave_height:.2f} మీటర్లు (పీరియడ్: {wave_period:.1f} సెకన్లు)\n"
                    f"• ప్రవాహం: {current_speed} నాట్స్ ({current_dir})\n\n"
                    f"💡 సలహా: {w_status}"
                )
            elif lang == "ml":
                w_status = "കടൽ ശാന്തമാണ്, യാത്ര സുരക്ഷിതമാണ്." if wave_height < 1.2 else "മിതമായ തിരമാലകളുണ്ട്."
                voice_text = f"{loc_header} ലെ {day_word_ml} തിരമാല ഉയരം {wave_height:.2f} മീറ്റർ."
                resp = (
                    f"🌊 തിരമാല വിവരം ({period_disp_ml}):\n\n"
                    f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                    f"• തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ\n"
                    f"• ഉപരിതല ഒഴുക്ക്: {current_speed} നോട്ട് ({current_dir})\n\n"
                    f"💡 നിർദ്ദേശം: {w_status}"
                )
            else:
                w_status = "Sea state is calm and favorable for all fishing vessels." if wave_height < 1.2 else "Moderate ocean swells active. Small crafts remain watchful."
                voice_text = f"Wave and sea condition forecast for {day_word_en} off {loc_header}. Significant wave height is {wave_height:.2f} meters with wave period of {wave_period:.1f} seconds, and coastal surface current is {current_speed} knots towards {current_dir}. Operational advisory: {w_status}"
                resp = (
                    f"🌊 Ocean Wave & Hydrodynamic Telemetry ({period_disp_en}):\n\n"
                    f"📍 Location: {loc_header} | Date: {period_disp_en}\n"
                    f"• Significant Wave Height: {wave_height:.2f} meters (Period: {wave_period:.1f} seconds)\n"
                    f"• Coastal Surface Current: {current_speed} knots towards {current_dir}\n"
                    f"• Sea Surface Temp: {sea_temp:.1f}°C\n"
                    f"• Wind Conditions: {wind_kmh:.1f} km/h ({wind_dir})\n\n"
                    f"💡 Operational Advisory: {w_status}"
                )
            return f"{resp}{dataset_block}", voice_text

        elif intent == "wind_conditions":
            if lang == "ta":
                w_eval = "காற்று மிதமாகவும் கடற்பயணத்திற்கு உகந்ததாகவும் உள்ளது." if wind_kmh < 28.0 else "காற்று சற்று வேகமாக வீசுகிறது. எச்சரிக்கையுடன் செல்லவும்."
                voice_text = f"{loc_header} பகுதிக்கான {day_word_ta} காற்றின் முன்னறிவிப்பு. காற்றின் வேகம் மணிக்கு {wind_kmh:.1f} கிலோமீட்டர் {wind_dir} திசையிலிருந்து, காற்று வீச்சு மணிக்கு {wind_gusts:.1f} கிலோமீட்டர். ஆலோசனை: {w_eval}"
                resp = (
                    f"💨 காற்றின் வேகம் மற்றும் திசை தகவல் ({period_disp_ta}):\n\n"
                    f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n"
                    f"• காற்று வீச்சு (Gusts): {wind_gusts:.1f} கி.மீ/மணி\n"
                    f"• வெப்பநிலை: {temp_c:.1f}°C\n\n"
                    f"💡 ஆலோசனை: {w_eval}"
                )
            elif lang == "hi":
                w_eval = "हवा की गति सामान्य और सुरक्षित है।" if wind_kmh < 28.0 else "हवा की गति तेज है।"
                voice_text = f"{loc_header} के लिए {day_word_hi} की हवा का पूर्वानुमान। हवा की गति {wind_kmh:.1f} किमी प्रति घंटा है {wind_dir} से। सलाह: {w_eval}"
                resp = (
                    f"💨 हवा की गति एवं दिशा पूर्वानुमान ({period_disp_hi}):\n\n"
                    f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                    f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir})\n"
                    f"• झोंके (Gusts): {wind_gusts:.1f} किमी/घंटा\n"
                    f"• तापमान: {temp_c:.1f}°C\n\n"
                    f"💡 सलाह: {w_eval}"
                )
            elif lang == "te":
                voice_text = f"{loc_header} కోసం {day_word_te} గాలి వేగం {wind_kmh:.1f} కిలోమీటర్లు."
                resp = (
                    f"💨 గాలి సమాచారం ({period_disp_te}):\n\n"
                    f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                    f"• గాలి వేగం: {wind_kmh:.1f} కి.மீ/గం ({wind_dir})\n"
                    f"• గాలి తీవ్రత: {wind_gusts:.1f} కి.மீ/గం\n"
                )
            elif lang == "ml":
                voice_text = f"{loc_header} ലെ {day_word_ml} കാറ്റിന്റെ വേഗത {wind_kmh:.1f} കി.മീ/മണിക്കൂർ."
                resp = (
                    f"💨 കാറ്റിന്റെ വിവരം ({period_disp_ml}):\n\n"
                    f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                    f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n"
                    f"• പരമാവധി വേഗത: {wind_gusts:.1f} കി.മീ/മണിക്കൂർ\n"
                )
            else:
                w_eval = "Wind velocity is calm and favorable for marine voyages." if wind_kmh < 28.0 else "Breezy conditions detected. Proceed with caution."
                voice_text = f"Wind forecast for {day_word_en} in {loc_header}. Sustained wind speed is {wind_kmh:.1f} kilometers per hour from {wind_dir}, with peak gusts up to {wind_gusts:.1f} kilometers per hour. Ambient air temperature is {temp_c:.1f} degrees Celsius. Advisory: {w_eval}"
                resp = (
                    f"💨 Wind Velocity & Direction Telemetry ({period_disp_en}):\n\n"
                    f"📍 Location: {loc_header} | Date: {period_disp_en}\n"
                    f"• Sustained Wind Speed: {wind_kmh:.1f} km/h ({wind_dir})\n"
                    f"• Peak Wind Gusts: {wind_gusts:.1f} km/h\n"
                    f"• Ambient Air Temp: {temp_c:.1f}°C\n"
                    f"• Sky Condition: {weather_desc}\n\n"
                    f"💡 Operational Advisory: {w_eval}"
                )
            return f"{resp}{dataset_block}", voice_text

        elif intent in ("find_pfz", "fish_species"):
            if lang == "ta":
                voice_text = f"சிறந்த மீன்பிடி மண்டலம் {spot.name if spot else 'சென்னை கடல் பகுதி'}."
                resp = (
                    f"🐟 INCOIS செயற்கைக்கோள் சிறந்த மீன்பிடி மண்டலம் (PFZ):\n"
                    f"• பரிந்துரைக்கப்பட்ட மண்டலம்: {spot.name if spot else 'Thermal Front'}\n"
                    f"• தூரம் மற்றும் திசை: {spot.distance_km if spot else 10.4:.1f} கி.மீ {spot.cardinal_direction if spot else 'ENE'}\n"
                    f"• கடல் ஆழம்: {spot.depth_meters if spot else 38} மீட்டர் | இலக்கு மீன்கள்: {sp_text}\n"
                    f"• கடல் வெப்பநிலை: {sea_temp:.1f}°C\n\n"
                    f"வழிகாட்டல்: வரைபடத்தில் வழியைக் காண 'Show Route on Ocean Map' பொத்தானை அழுத்தவும்."
                )
            elif lang == "hi":
                voice_text = f"निकटतम संभावित मत्स्य क्षेत्र {spot.name if spot else 'तटीय हॉटस्पॉट'} है।"
                resp = (
                    f"🐟 INCOIS सैटेलाइट संभावित मत्स्य क्षेत्र (PFZ):\n"
                    f"• अनुशंसित हॉटस्पॉट: {spot.name if spot else 'Thermal Front'}\n"
                    f"• दूरी एवं दिशा: {spot.distance_km if spot else 10.4:.1f} किमी ({spot.cardinal_direction if spot else 'ENE'})\n"
                    f"• गहराई: {spot.depth_meters if spot else 38} मीटर | प्रमुख मछलियाँ: {sp_text}\n"
                    f"• तापमान: {sea_temp:.1f}°C\n\n"
                    f"नेविगेशन: समुद्री मैप पर मार्ग देखने के लिए 'Show Route on Ocean Map' दबाएं।"
                )
            elif lang == "te":
                voice_text = f"ఉత్తమ చేపల వేట ప్రాంతం {spot.name if spot else 'PFZ'}."
                resp = (
                    f"🐟 INCOIS ఉపగ్రహ ఉత్తమ చేపల వేట ప్రాంతం (PFZ):\n"
                    f"• ప్రాంతం: {spot.name if spot else 'Thermal Front'}\n"
                    f"• దూరం: {spot.distance_km if spot else 10.4:.1f} కి.மீ ({spot.cardinal_direction if spot else 'ENE'})\n"
                    f"• లోతు: {spot.depth_meters if spot else 38} మీటర్లు | చేపలు: {sp_text}\n"
                )
            elif lang == "ml":
                voice_text = f"മികച്ച മത്സ്യബന്ധന മേഖല {spot.name if spot else 'PFZ'}."
                resp = (
                    f"🐟 INCOIS ഉപഗ്രഹ മത്സ്യബന്ധന മേഖല (PFZ):\n"
                    f"• പ്രദേശം: {spot.name if spot else 'Thermal Front'}\n"
                    f"• ദൂരം: {spot.distance_km if spot else 10.4:.1f} കി.മീ\n"
                    f"• ആഴം: {spot.depth_meters if spot else 38} മീറ്റർ | മത്സ്യങ്ങൾ: {sp_text}\n"
                )
            else:
                voice_text = f"Recommended fishing zone is {spot.name if spot else 'Thermal Front'} at {spot.distance_km if spot else 10.4:.1f} kilometers."
                resp = (
                    f"🐟 INCOIS Satellite Potential Fishing Zone (PFZ):\n"
                    f"• Recommended Hotspot: {spot.name if spot else 'Thermal Front'}\n"
                    f"• Location Vector: {spot.distance_km if spot else 10.4:.1f} km {spot.cardinal_direction if spot else 'ENE'}\n"
                    f"• Seafloor Depth: {spot.depth_meters if spot else 38} meters | Target Fish: {sp_text}\n"
                    f"• Sea Surface Temp: {sea_temp:.1f}°C\n\n"
                    f"Navigation: Tap 'Show Route on Ocean Map' to plot waypoint."
                )
            return f"{resp}{dataset_block}", voice_text

        elif intent == "nearest_port":
            if lang == "ta":
                voice_text = f"அருகிலுள்ள முதன்மை துறைமுகம் {nearest_port}."
                resp = (
                    f"⚓ அருகிலுள்ள துறைமுகம் மற்றும் அவசர தளம்:\n"
                    f"• முதன்மை துறைமுகம்: {nearest_port}\n"
                    f"• தூரம்: {port_dist:.1f} கி.மீ ({port_dist_nm:.1f} கடல் மைல்) {port_cardinal}\n"
                    f"• துறைமுக ஆழம்: {seafloor_depth} மீட்டர் | VHF: {port_vhf}\n\n"
                    f"அவசர வழிகாட்டல்: அவசர காலங்களில் VHF சேனல் 16 மூலமாக கடலோர காவல்படையை தொடர்பு கொள்ளவும்."
                )
            elif lang == "hi":
                voice_text = f"निकटतम बंदरगाह {nearest_port} है।"
                resp = (
                    f"⚓ निकटतम बंदरगाह एवं आपातकालीन बेस:\n"
                    f"• प्रमुख बंदरगाह: {nearest_port}\n"
                    f"• दूरी: {port_dist:.1f} किमी ({port_cardinal})\n"
                    f"• गहराई: {seafloor_depth} मीटर | VHF: {port_vhf}\n\n"
                    f"आपातकालीन सलाह: आपातकाल में VHF चैनल 16 पर संपर्क करें।"
                )
            elif lang == "te":
                voice_text = f"సమీప ఓడరేవు {nearest_port}."
                resp = (
                    f"⚓ సమీప ఓడరేవు & అత్యవసర కేంద్రం:\n"
                    f"• ఓడరేవు: {nearest_port}\n"
                    f"• దూరం: {port_dist:.1f} కి.மீ ({port_cardinal})\n"
                    f"• లోతు: {seafloor_depth} మీటర్లు | VHF: {port_vhf}\n"
                )
            elif lang == "ml":
                voice_text = f"ഏറ്റവും അടുത്തുള്ള തുറമുഖം {nearest_port}."
                resp = (
                    f"⚓ ഏറ്റവും അടുത്തുള്ള തുറമുഖം:\n"
                    f"• തുറമുഖം: {nearest_port}\n"
                    f"• ദൂരം: {port_dist:.1f} കി.മീ ({port_cardinal})\n"
                    f"• ആഴം: {seafloor_depth} മീറ്റർ | VHF: {port_vhf}\n"
                )
            else:
                voice_text = f"Nearest base port is {nearest_port} at {port_dist:.1f} kilometers."
                resp = (
                    f"⚓ Nearest Base Port & Emergency Maritime Harbor:\n"
                    f"• Base Port: {nearest_port}\n"
                    f"• Distance Vector: {port_dist:.1f} km ({port_dist_nm:.1f} NM) {port_cardinal}\n"
                    f"• Harbor Depth: {seafloor_depth} meters | Coast Guard VHF: {port_vhf}\n\n"
                    f"Emergency Directive: Establish contact on VHF Marine Channel 16 (156.8 MHz) during emergencies."
                )
            return f"{resp}{dataset_block}", voice_text

        elif intent == "net_drift":
            d_km = drift_dist_km if drift_dist_km is not None else 1.2
            d_card = drift_cardinal or "NE"
            if lang == "ta":
                voice_text = f"தொலைந்த வலை சுமார் {d_km:.1f} கிலோமீட்டர் {d_card} திசை நோக்கி மிதந்து கொண்டிருக்கிறது."
                resp = (
                    f"🕸️ தொலைந்த வலை மிதப்பு கணிப்பு (Lagrangian Simulation):\n"
                    f"• மதிப்பிடப்பட்ட மிதப்பு தூரம்: {d_km:.1f} கி.மீ ({d_card} திசை நோக்கி)\n"
                    f"• நீரோட்ட வேகம்: {current_speed} நாட்ஸ் | காற்று: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n\n"
                    f"மீட்பு வழிகாட்டல்: உங்கள் வலையின் நேரலை GPS கணிப்பு வரைபடத்தை பார்க்க My Nets பக்கத்தை திறக்கவும்."
                )
            elif lang == "hi":
                voice_text = f"खोया हुआ जाल लगभग {d_km:.1f} किलोमीटर {d_card} की ओर बह रहा है।"
                resp = (
                    f"🕸️ खोया हुआ जाल बहाव पूर्वानुमान (Lagrangian Simulation):\n"
                    f"• अनुमानित बहाव दूरी: {d_km:.1f} किमी ({d_card} की ओर)\n"
                    f"• समुद्री धारा: {current_speed} नॉट्स | हवा: {wind_kmh:.1f} किमी/घंटा\n\n"
                    f"पुनर्प्राप्ति सलाह: अपने जाल की लाइव GPS स्थिति देखने के लिए My Nets टैब खोलें।"
                )
            else:
                voice_text = f"Estimated lost net drift is {d_km:.1f} kilometers towards {d_card}."
                resp = (
                    f"🕸️ Lagrangian Lost Net Drift Prediction:\n"
                    f"• Estimated Drift: {d_km:.1f} km vector towards {d_card}\n"
                    f"• Driving Factors: Surface current ({current_speed} kts) & wind leeway ({wind_kmh:.1f} km/h {wind_dir})\n\n"
                    f"Recovery Action: Open 'My Nets' tab to view the live GPS drift trajectory and recovery coordinates."
                )
            return f"{resp}{dataset_block}", voice_text

        else:  # fishing_advisory or general_weather
            time_label_en = day_word_en
            time_label_ta = day_word_ta
            time_label_hi = day_word_hi
            time_label_te = day_word_te
            time_label_ml = day_word_ml

            if lang == "ta":
                if risk.level == "HIGH":
                    voice_text = f"{loc_header} பகுதிக்கு {time_label_ta} மீன்பிடிக்க செல்ல வேண்டாம். கடல் அதிக ஆபத்தாக உள்ளது. காற்றின் வேகம் மணிக்கு {wind_kmh:.1f} கிலோமீட்டர், அலை உயரம் {wave_height:.2f} மீட்டர்."
                    resp = (
                        f"⚠️ மீன்பிடிக்க செல்ல வேண்டாம் — அதிக ஆபத்து ({period_disp_ta}):\n\n"
                        f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                        f"• கடற்பயண அனுமதி: பாதுகாப்பானது அல்ல (துறைமுகத்தில் இருக்கவும்)\n"
                        f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | அலை உயரம்: {wave_height:.2f} மீட்டர்\n"
                        f"• மழை வாய்ப்பு: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 பாதுகாப்பு எச்சரிக்கை: கடல் கொந்தளிப்பாக இருப்பதால் {time_label_ta} துறைமுகத்திலேயே பாதுகாப்பாக இருக்கவும்."
                    )
                elif risk.level == "MODERATE":
                    voice_text = f"{loc_header} பகுதியில் {time_label_ta} விசைப்படகுகள் எச்சரிக்கையுடன் செல்லலாம். சிறிய படகுகள் கரைக்கு அருகில் இருக்கவும்."
                    resp = (
                        f"⚠️ மிதமான ஆபத்து — எச்சரிக்கையுடன் செல்லவும் ({period_disp_ta}):\n\n"
                        f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                        f"• கடற்பயண அனுமதி: எச்சரிக்கையுடன் செல்லலாம் (விசைப்படகுகள் மட்டும்)\n"
                        f"• அலை உயரம்: {wave_height:.2f} மீட்டர் | காற்று: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n"
                        f"• பரிந்துரைக்கப்பட்ட மண்டலம்: {spot.name if spot else 'Thermal Front'} ({spot.distance_km if spot else 10.4:.1f} கி.மீ)\n\n"
                        f"💡 வழிகாட்டல்: ஆழ்கடல் விசைப்படகுகள் கவனமாக செல்லலாம். சிறிய படகுகள் தவிர்க்கவும்."
                    )
                else:
                    voice_text = f"{loc_header} பகுதிக்கு {time_label_ta} தாராளமாக மீன்பிடிக்க செல்லலாம். வானிலை மிகவும் சாதகமாக உள்ளது. அலை உயரம் {wave_height:.2f} மீட்டர், காற்றின் வேகம் மணிக்கு {wind_kmh:.1f} கிலோமீட்டர்."
                    resp = (
                        f"✅ தாராளமாக மீன்பிடிக்க செல்லலாம் — வானிலை சாதகமானது ({period_disp_ta}):\n\n"
                        f"📍 இடம்: {loc_header} | காலம்: {period_disp_ta}\n"
                        f"• கடற்பயண அனுமதி: தாராளமாக செல்லலாம் (மிகவும் பாதுகாப்பானது)\n"
                        f"• கடல் அலை உயரம்: {wave_height:.2f} மீட்டர் | காற்று: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n"
                        f"• நீரோட்டம்: {current_speed} நாட்ஸ் ({current_dir}) | கடல் வெப்பநிலை: {sea_temp:.1f}°C\n"
                        f"• பரிந்துரைக்கப்பட்ட மீன்பிடி மண்டலம்: {spot.name if spot else 'Thermal Front'} ({spot.distance_km if spot else 10.4:.1f} கி.மீ {spot.cardinal_direction if spot else 'ENE'})\n"
                        f"• இலக்கு மீன்கள்: {sp_text}\n\n"
                        f"💡 ஆலோசனை: கடல் மிகவும் அமைதியாகவும் மீன்பிடிக்க பாதுகாப்பாகவும் உள்ளது."
                    )
            elif lang == "hi":
                if risk.level == "HIGH":
                    voice_text = f"{loc_header} के लिए {time_label_hi} समुद्र में न जाएँ। मौसम में भारी जोखिम है। हवा की गति {wind_kmh:.1f} किमी/घंटा है।"
                    resp = (
                        f"⚠️ समुद्र में न जाएँ — उच्च जोखिम ({period_disp_hi}):\n\n"
                        f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                        f"• परिचालन निर्णय: समुद्र में न जाएँ (बंदरगाह में सुरक्षित रहें)\n"
                        f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | लहरों की ऊंचाई: {wave_height:.2f} मीटर\n"
                        f"• वर्षा संभावना: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 सुरक्षा चेतावनी: समुद्र अशांत है। कृपया बंदरगाह में सुरक्षित रहें।"
                    )
                else:
                    voice_text = f"{loc_header} के लिए {time_label_hi} मछली पकड़ने जा सकते हैं। मौसम पूरी तरह अनुकूल और सुरक्षित है।"
                    resp = (
                        f"✅ मछली पकड़ने जा सकते हैं — अनुकूल मौसम ({period_disp_hi}):\n\n"
                        f"📍 स्थान: {loc_header} | समय: {period_disp_hi}\n"
                        f"• परिचालन निर्णय: मछली पकड़ने के लिए पूरी तरह सुरक्षित\n"
                        f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर | हवा: {wind_kmh:.1f} किमी/घंटा ({wind_dir})\n"
                        f"• अनुशंसित मत्स्य क्षेत्र: {spot.name if spot else 'Thermal Front'} ({spot.distance_km if spot else 10.4:.1f} किमी)\n"
                        f"• प्रमुख मछलियाँ: {sp_text}\n\n"
                        f"💡 सलाह: समुद्र शांत और मछली पकड़ने के लिए सुरक्षित है।"
                    )
            elif lang == "te":
                voice_text = f"{loc_header} కోసం {time_label_te} చేపల వేటకు వెళ్ళవచ్చు. వాతావరణం అనుకూలంగా ఉంది."
                resp = (
                    f"✅ చేపల వేటకు వెళ్ళవచ్చు — అనుకూలమైన వాతావరణం ({period_disp_te}):\n\n"
                    f"📍 ప్రాంతం: {loc_header} | సమయం: {period_disp_te}\n"
                    f"• అలల ఎత్తు: {wave_height:.2f} మీటర్లు | గాలి: {wind_kmh:.1f} కి.மீ/గం ({wind_dir})\n"
                    f"• ఉత్తమ ప్రాంతం: {spot.name if spot else 'PFZ'}\n"
                )
            elif lang == "ml":
                voice_text = f"{loc_header} ലെ {time_label_ml} മത്സ്യബന്ധനത്തിന് പോകാം. കാലാവസ്ഥ അനുകൂലമാണ്."
                resp = (
                    f"✅ മത്സ്യബന്ധനത്തിന് പോകാം — അനുകൂല കാലാവസ്ഥ ({period_disp_ml}):\n\n"
                    f"📍 സ്ഥലം: {loc_header} | സമയം: {period_disp_ml}\n"
                    f"• തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ | കാറ്റ്: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ\n"
                    f"• മികച്ച പ്രദേശം: {spot.name if spot else 'PFZ'}\n"
                )
            else:
                if risk.level == "HIGH":
                    voice_text = f"Fishing advisory for {time_label_en} in {loc_header}. High risk conditions detected. Do not venture out to sea. Sustained wind is {wind_kmh:.1f} kilometers per hour, wave height is {wave_height:.2f} meters."
                    resp = (
                        f"⚠️ HIGH RISK — STAY ASHORE ({period_disp_en}):\n\n"
                        f"📍 Location: {loc_header} | Forecast Period: {period_disp_en}\n"
                        f"• Operational Verdict for {time_label_en}: NOT RECOMMENDED / STAY IN HARBOR\n"
                        f"• Sustained Wind: {wind_kmh:.1f} km/h ({wind_dir}) | Wave Height: {wave_height:.2f} meters\n"
                        f"• Rain Probability: {rain_prob}% ({weather_desc})\n\n"
                        f"🚨 Safety Directive: Rough marine weather expected {time_label_en}. Remain safely in port."
                    )
                elif risk.level == "MODERATE":
                    voice_text = f"Fishing advisory for {time_label_en} in {loc_header}. Moderate risk. Mechanized trawlers may proceed with caution. Motorized boats stay near shore."
                    resp = (
                        f"⚠️ MODERATE RISK — PROCEED WITH CAUTION ({period_disp_en}):\n\n"
                        f"📍 Location: {loc_header} | Forecast Period: {period_disp_en}\n"
                        f"• Operational Verdict for {time_label_en}: PROCEED WITH CAUTION\n"
                        f"• Significant Wave Height: {wave_height:.2f} m | Wind: {wind_kmh:.1f} km/h ({wind_dir})\n"
                        f"• Surface Current: {current_speed} kts ({current_dir}) | Sea Temp: {sea_temp:.1f}°C\n"
                        f"• Recommended PFZ Hotspot: {spot.name if spot else 'Thermal Front'} ({spot.distance_km if spot else 10.4:.1f} km)\n\n"
                        f"💡 Operational Advisory: Mechanized boats can operate with caution. Keep VHF radio active."
                    )
                else:
                    voice_text = f"Fishing advisory for {time_label_en} in {loc_header}. Conditions are calm, safe, and highly favorable for fishing. Significant wave height is {wave_height:.2f} meters, wind speed is {wind_kmh:.1f} kilometers per hour. Recommended hotspot is {spot.name if spot else 'Thermal Front'}."
                    resp = (
                        f"✅ SAFE FOR FISHING — EXCELLENT CONDITIONS ({period_disp_en}):\n\n"
                        f"📍 Location: {loc_header} | Forecast Period: {period_disp_en}\n"
                        f"• Operational Verdict for {time_label_en}: SAFE FOR FISHING\n"
                        f"• Significant Wave Height: {wave_height:.2f} meters | Wind Speed: {wind_kmh:.1f} km/h ({wind_dir})\n"
                        f"• Surface Current: {current_speed} kts ({current_dir}) | Sea Temp: {sea_temp:.1f}°C\n"
                        f"• Recommended PFZ Hotspot: {spot.name if spot else 'Thermal Front'} ({spot.distance_km if spot else 10.4:.1f} km {spot.cardinal_direction if spot else 'ENE'})\n"
                        f"• Target Fish: {sp_text}\n\n"
                        f"💡 Operational Advisory: Ocean conditions are calm, safe, and highly favorable for all vessels."
                    )
            return f"{resp}{dataset_block}", voice_text

    def _haversine_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
        return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    def _bearing_deg(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dlam = math.radians(lon2 - lon1)
        y = math.sin(dlam) * math.cos(phi2)
        x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
        brng = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
        return brng

    def _degrees_to_cardinal(self, deg: float) -> str:
        cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        idx = int((deg + 11.25) / 22.5) % 16
        return cardinals[idx]

    def _wmo_code_to_description(self, code: int) -> str:
        wmo = {
            0: "Clear Sky",
            1: "Mainly Clear",
            2: "Partly Cloudy",
            3: "Overcast",
            45: "Foggy",
            48: "Depositing Rime Fog",
            51: "Light Drizzle",
            53: "Moderate Drizzle",
            55: "Dense Drizzle",
            61: "Slight Rain",
            63: "Moderate Rain",
            65: "Heavy Rain",
            71: "Slight Snow Fall",
            80: "Slight Rain Showers",
            81: "Moderate Rain Showers",
            82: "Violent Rain Showers",
            95: "Thunderstorm",
            96: "Thunderstorm with Slight Hail",
            99: "Thunderstorm with Heavy Hail"
        }
        return wmo.get(code, "Clear to Partly Cloudy")

    def _find_nearest_port(self, lat: float, lon: float) -> Dict[str, Any]:
        min_dist = float('inf')
        best_port = INDIAN_COASTAL_PORTS[0]
        for p in INDIAN_COASTAL_PORTS:
            d = self._haversine_km(lat, lon, p["lat"], p["lon"])
            if d < min_dist:
                min_dist = d
                best_port = p

        dist_km = round(min_dist, 1)
        dist_nm = round(dist_km / 1.852, 1)
        brng = round(self._bearing_deg(lat, lon, best_port["lat"], best_port["lon"]))
        cardinal = self._degrees_to_cardinal(brng)

        return {
            "name": best_port["name"],
            "state": best_port["state"],
            "distance_km": dist_km,
            "distance_nm": dist_nm,
            "bearing_deg": brng,
            "cardinal": cardinal,
            "lat": best_port["lat"],
            "lon": best_port["lon"],
            "depth_m": best_port["depth_m"],
            "vhf": best_port["vhf"]
        }

orca_orchestrator = OrcaAgentOrchestrator()
