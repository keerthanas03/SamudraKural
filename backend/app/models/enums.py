from enum import Enum

class EmergencyType(str, Enum):
    GENERAL = "General Emergency"
    BOAT_PROBLEM = "Boat problem"
    ENGINE_FAILURE = "Engine Failure"
    MEDICAL = "Medical emergency"
    MEDICAL_SHORT = "Medical"
    WEATHER = "Bad weather"
    STORM_STRANDED = "Storm/Stranded"
    CAPSIZING = "Capsizing"
    FIRE = "Fire"
    COLLISION = "Collision"
    NAVIGATION = "Navigation problem"
    GEAR_PROBLEM = "Net / fishing gear problem"
    HULL_INGRESS = "Hull Water Ingress"
    RUDDER_LOST = "Rudder Control Lost"
    OTHER = "Other"

class SOSStatus(str, Enum):
    ACTIVE = "ACTIVE"
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    HELP_ON_THE_WAY = "HELP_ON_THE_WAY"
    RESCUE_ASSIGNED = "RESCUE_ASSIGNED"
    RESCUE_IN_PROGRESS = "RESCUE_IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"
    FALSE_ALARM = "FALSE_ALARM"

class SOSDeliveryStatus(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE_ORIGIN = "OFFLINE_ORIGIN"
    OFFLINE_RELAYED = "OFFLINE_RELAYED"
    SYNCED = "SYNCED"

class SOSPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class SOSResponseType(str, Enum):
    YES_HELP = "YES_HELP"
    NO = "NO"

class RescueMissionStatus(str, Enum):
    ASSIGNED = "ASSIGNED"
    DEPARTED = "DEPARTED"
    APPROACHING = "APPROACHING"
    VICTIM_LOCATED = "VICTIM_LOCATED"
    RETURNING = "RETURNING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
