export interface FishermanUser {
  id?: string;
  name: string;
  phone: string;
  emergencyPhone?: string;
  email?: string;
  address?: string;
  pincode?: string;
  vesselName?: string;
  vesselRegistration?: string;
  vesselType?: string;
  homePort?: string;
  licenseNumber?: string;
  aadhaarNumber?: string;
  vhfRadioActive?: boolean;
  lifeJacketsCount?: number;
}

export interface CoastalGuardOfficer {
  id?: string;
  serviceId: string;
  name: string;
  rank: string;
  station: string;
  phone: string;
  email: string;
  jurisdiction: string;
  pin: string;
  badgeNumber?: string;
}

export interface CGRegisterPayload {
  name: string;
  serviceId: string;
  rank: string;
  station: string;
  phone: string;
  email: string;
  jurisdiction: string;
  pin: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  pin: string;
  address: string;
  pincode: string;
}

export interface LoginPayload {
  phone: string;
  pin: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: FishermanUser;
}

export type SupportedLanguage = 
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'ml' // Malayalam
  | 'kn' // Kannada
  | 'mr' // Marathi
  | 'gu' // Gujarati
  | 'or' // Odia
  | 'bn' // Bengali
  | 'hi' // Hindi
  | 'en';// English

export interface LanguageOption {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
}
