export type SOSUIState = 
  | 'idle'
  | 'getting_location'
  | 'checking_connection'
  | 'sending'
  | 'pending'
  | 'active'
  | 'cancelling'
  | 'cancelled'
  | 'error';

export type SOSLifecycleStatus =
  | 'ACTIVE'
  | 'ACKNOWLEDGED'
  | 'HELP_ON_THE_WAY'
  | 'RESCUE_ASSIGNED'
  | 'RESCUE_IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'FALSE_ALARM';

export type SOSDeliveryStatus =
  | 'LOCAL_ONLY'
  | 'SEARCHING_FOR_PEER'
  | 'P2P_DELIVERED'
  | 'RELAYING'
  | 'GATEWAY_PENDING'
  | 'SYNC_PENDING'
  | 'SYNCED'
  | 'ONLINE'
  | 'OFFLINE_ORIGIN'
  | 'OFFLINE_RELAYED';

export type SOSPacketType =
  | 'SOS_ALERT'
  | 'SOS_RESPONSE'
  | 'SOS_STATUS_UPDATE'
  | 'SOS_CANCEL'
  | 'SOS_ACK';

export type SOSResponseAction = 'YES_HELP' | 'RELAY_ONLY' | 'NO';

export type SOSPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type EmergencyType = 
  | 'General Emergency'
  | 'Boat problem'
  | 'Medical emergency'
  | 'Bad weather'
  | 'Navigation problem'
  | 'Net / fishing gear problem'
  | 'Other';

export type CommunicationStatus = 'online' | 'offline';

export interface LocationResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  available: boolean;
  errorMessage?: string;
}

/**
 * Transport-Independent Unified Offline SOS Mesh Packet Schema
 */
export interface MeshSOSPacket {
  packet_version: number;
  packet_type: SOSPacketType;
  public_sos_id: string; // Global UUID immutable across relays and sync
  origin_fisherman_id: number;
  origin_device_id: string;
  origin_fisherman_name?: string;
  origin_fisherman_phone?: string;

  emergency_type: string;
  priority: SOSPriority;
  sos_status: SOSLifecycleStatus;
  delivery_status: SOSDeliveryStatus;

  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  battery_percent?: number | null;
  people_affected?: number;
  description?: string;

  created_at: string;
  last_updated_at: string;

  hop_count: number;
  max_hops: number; // default 5
  ttl_minutes: number; // default 60

  // Response fields (for SOS_RESPONSE):
  responder_fisherman_id?: number;
  responder_device_id?: string;
  responder_name?: string;
  response_action?: SOSResponseAction;
  response_message?: string;

  // Relay tracking & loop prevention
  relay_path?: string[];
  relayed_by_device_id?: string;
}

export type OfflineSOSPacket = MeshSOSPacket;

export interface OfflineSOSResponsePacket {
  public_sos_id: string;
  responder_fisherman_id: number;
  responder_device_id: string;
  responder_name?: string;
  response: 'YES_HELP' | 'RELAY_ONLY' | 'NO';
  action?: SOSResponseAction;
  latitude?: number | null;
  longitude?: number | null;
  message?: string;
  created_at: string;
  hop_count: number;
  max_hops: number;
  ttl_minutes: number;
  packet_version: number;
}

export interface SOSDispatchResult {
  success: boolean;
  public_sos_id: string;
  sos_id?: number;
  delivery_status: SOSDeliveryStatus;
  status: SOSLifecycleStatus;
  transport_used: 'ONLINE' | 'OFFLINE_P2P' | 'OFFLINE_MESH';
  timestamp: string;
  message?: string;
  nearby_recipients_count?: number;
}

// Backward compatibility interfaces
export interface SOSPacket {
  id: string;
  public_sos_id?: string;
  boatId?: string;
  userId?: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  emergencyType: EmergencyType;
  batteryLevel: number;
  communicationStatus: CommunicationStatus;
  status: 'pending' | 'active' | 'cancelled';
  rescueStationRouted?: string;
}

export interface MockSendResult {
  success: boolean;
  referenceId: string;
  timestamp: string;
  message?: string;
}
