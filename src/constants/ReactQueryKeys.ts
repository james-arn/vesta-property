const REACT_QUERY_KEYS = {
  PROPERTY_DATA: "propertyData",
  CRIME_SCORE: "crimeScore",
  PREMIUM_STREET_DATA: "premiumStreetData",
  REVERSE_GEOCODE: "reverseGeocode",
  PROCESSED_EPC: "processedEpc",
  OFFLINE_CACHE: "vestaOfflineCache",
} as const;

export type ReactQueryKeys = (typeof REACT_QUERY_KEYS)[keyof typeof REACT_QUERY_KEYS];

export default REACT_QUERY_KEYS;
