from datetime import datetime, timezone, timedelta
from typing import Optional

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def ensure_utc(dt: Optional[datetime]) -> datetime:
    """
    Ensure a datetime object is timezone-aware and converted to UTC.
    If naive, assume UTC.
    """
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_ist(dt: datetime) -> datetime:
    """
    Convert a UTC datetime to Indian Standard Time (IST).
    """
    utc_dt = ensure_utc(dt)
    return utc_dt.astimezone(IST_OFFSET)

def calculate_age_minutes(dt: datetime) -> int:
    """
    Calculate the age in minutes of a given timestamp relative to now (UTC).
    """
    utc_dt = ensure_utc(dt)
    now_utc = datetime.now(timezone.utc)
    diff = now_utc - utc_dt
    return max(0, int(diff.total_seconds() / 60))
