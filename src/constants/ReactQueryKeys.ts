const REACT_QUERY_KEYS = {
  PROPERTY_DATA: "propertyData",
  CRIME_SCORE: "crimeScore",
} as const;

export type ReactQueryKeys = (typeof REACT_QUERY_KEYS)[keyof typeof REACT_QUERY_KEYS];

export default REACT_QUERY_KEYS;
