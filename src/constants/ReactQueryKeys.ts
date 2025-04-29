const REACT_QUERY_KEYS = {
  PROPERTY_DATA: "propertyData" as const,
  CRIME_SCORE: "crimeScore" as const,
  PREMIUM_STREET_DATA: "premiumStreetData" as const,
  REVERSE_GEOCODE: "reverseGeocode" as const,
  PROCESSED_EPC: "processedEpc" as const,
  OFFLINE_CACHE: "vestaOfflineCache" as const,
} as const;

export type ReactQueryKeys = (typeof REACT_QUERY_KEYS)[keyof typeof REACT_QUERY_KEYS];

export default REACT_QUERY_KEYS;
