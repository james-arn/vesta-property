import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import { logErrorToSentry } from "@/utils/sentry";
import { useQuery } from "@tanstack/react-query";
import _isEqual from "lodash/isEqual";
import { useEffect, useMemo, useRef } from "react";

export type ReverseGeocodeResponse = {
  address: string;
  postcode: string;
};

// Reverse geocoding function using Nominatim
const fetchReverseGeocode = async (
  lat: string,
  lng: string
): Promise<{ address: string; postcode: string }> => {
  try {
    const url = `${process.env.VESTA_PROPERTY_DATA_PRODUCTION_ONLY_ENDPOINT}/getReverseGeocode?lat=${lat}&lng=${lng}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }
    const data: ReverseGeocodeResponse = await response.json();

    return {
      address: data.address,
      postcode: data.postcode,
    };
  } catch (error) {
    logErrorToSentry(error);
    throw error;
  }
};

export function useReverseGeocode(
  lat: string,
  lng: string,
  onSuccess: (data: ReverseGeocodeResponse) => void
) {
  // Create a stable query key
  const currentKey = useMemo(() => [REACT_QUERY_KEYS.REVERSE_GEOCODE, lat, lng], [lat, lng]);

  // Use a ref to store the stable key and update only when the new key is actually different
  const stableKeyRef = useRef(currentKey);

  if (!_isEqual(stableKeyRef.current, currentKey)) {
    stableKeyRef.current = currentKey;
  }

  const query = useQuery({
    queryKey: stableKeyRef.current,
    queryFn: () => fetchReverseGeocode(lat, lng),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // Cache for 60 mins after inactive
    enabled: Boolean(lat) && Boolean(lng),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(
    function onSuccessCallback() {
      if (query.data && onSuccess) {
        onSuccess(query.data);
      }
    },
    [query.data, onSuccess]
  );

  return query;
}
