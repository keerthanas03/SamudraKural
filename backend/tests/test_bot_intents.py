import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import asyncio
from app.services.orca_agent_orchestrator import orca_orchestrator

async def run_verification():
    out_file = Path(__file__).parent / "test_results.txt"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write("ORCA 12-AGENT BOT INTENT VERIFICATION RESULTS\n")
        f.write("=============================================\n\n")

    questions = [
        ("Can I go fishing tomorrow from Chennai?", "fishing_advisory"),
        ("Where is the nearest mackerel potential fishing zone?", "find_pfz"),
        ("What is the wave height?", "wave_conditions"),
        ("How strong is the wind?", "wind_conditions"),
        ("Where is the nearest port?", "nearest_port"),
        ("What fish can I catch?", "fish_species"),
    ]

    for i, (q, expected_intent) in enumerate(questions, 1):
        res = await orca_orchestrator.process_query(query=q, lat=13.0827, lon=80.3800, language="en")
        output_block = (
            f"=== QUESTION {i}: '{q}' ===\n"
            f"DETECTED INTENT: {res.intent} (Expected: {expected_intent})\n"
            f"RISK LEVEL: {res.risk_assessment.level} ({res.risk_assessment.title})\n"
            f"RESPONSE TEXT:\n{res.response_text}\n"
            f"VOICE TEXT:\n{res.voice_speech_text}\n"
            f"========================================================\n\n"
        )
        with open(out_file, "a", encoding="utf-8") as f:
            f.write(output_block)
            f.flush()
        assert res.intent == expected_intent

    with open(out_file, "a", encoding="utf-8") as f:
        f.write("SUCCESS: ALL 6 QUESTIONS PRODUCED TAILORED DYNAMIC RESPONSES.\n")

if __name__ == "__main__":
    asyncio.run(run_verification())
