import REACT_QUERY_KEYS from "@/constants/ReactQueryKeys";
import {
  GetPremiumStreetDataResponse,
  PremiumFetchContext,
  SnapshotContextData,
} from "@/types/premiumStreetData";
import { Address, ConfidenceLevels, EpcData, EpcDataSourceType } from "@/types/property";
import { UserProfile } from "@/types/userProfile";
import { QueryClient } from "@tanstack/react-query";
import { RefObject } from "react";

const minimalAddress: Address = {
  displayAddress: null,
  postcode: null,
  isAddressConfirmedByUser: false,
  confirmedBuilding: null,
  confirmedStreet: null,
  confirmedTown: null,
  confirmedPostcode: null,
};

const minimalEpcData: EpcData = {
  url: null,
  displayUrl: null,
  automatedProcessingResult: null,
  value: null,
  confidence: ConfidenceLevels.NONE,
  source: EpcDataSourceType.NONE,
  error: null,
};

interface AutoTriggerAutoPremiumSearchParams {
  propertyId: string | null;
  isAuthenticated: boolean;
  userProfile: UserProfile | undefined;
  queryClient: QueryClient;
  activatePremiumSearch: (context: PremiumFetchContext) => void;
  autoTriggerPendingForIdRef: RefObject<string | null>;
}

/**
 * Checks conditions and potentially triggers an automatic premium search
 * for a property that has been previously searched by the user but isn't
 * currently cached locally. Includes a lock to prevent double triggers.
 */
export const checkAndTriggerPremiumSearchOnPropertyIdMatch = ({
  propertyId,
  isAuthenticated,
  userProfile,
  queryClient,
  activatePremiumSearch,
  autoTriggerPendingForIdRef,
}: AutoTriggerAutoPremiumSearchParams): void => {
  console.log(
    `[Helper] Entered checkAndTrigger. propertyId: ${propertyId}, pendingIdRef: ${autoTriggerPendingForIdRef.current}, auth: ${isAuthenticated}`
  );

  // Exit if basic conditions not met
  if (!propertyId || !isAuthenticated || !userProfile?.searchedPropertyIds?.length) {
    return;
  }

  // Check the lock
  const isTriggerPending = autoTriggerPendingForIdRef.current === propertyId;
  if (isTriggerPending) {
    return; // Exit if already pending
  }

  const hasBeenSearched = userProfile.searchedPropertyIds.includes(propertyId);
  const isPremiumDataCachedLocally = !!queryClient.getQueryData<
    GetPremiumStreetDataResponse | undefined
  >([REACT_QUERY_KEYS.PREMIUM_STREET_DATA, propertyId]);

  if (hasBeenSearched && !isPremiumDataCachedLocally) {
    const minimalContext: PremiumFetchContext = {
      propertyId,
      currentContext: {
        confirmedAddress: minimalAddress,
        epc: minimalEpcData,
      } as SnapshotContextData,
    };
    autoTriggerPendingForIdRef.current = propertyId;
    activatePremiumSearch(minimalContext);
  }
};
