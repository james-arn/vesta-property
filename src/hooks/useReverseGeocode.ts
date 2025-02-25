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
    const url = `${process.env.VESTA_AWS_ENDPOINT}/getReverseGeocode?lat=${lat}&lng=${lng}`;
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
    console.log("hit");
    stableKeyRef.current = currentKey;
  }

  console.log(
    "stableKeyRef.current",
    stableKeyRef.current,
    "currentKey",
    currentKey,
    "lat",
    lat,
    "lng",
    lng
  );

  const query = useQuery({
    queryKey: stableKeyRef.current,
    queryFn: () => fetchReverseGeocode(lat, lng),
    staleTime: 24 * 60 * 60 * 1000, // Cache the data for 1 day
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
