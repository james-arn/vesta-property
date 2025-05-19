import Alert from '@/components/ui/Alert';
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import { ActionEvents } from '@/constants/actionEvents';
import VIEWS from '@/constants/views';
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { usePersistentPremiumData } from '@/hooks/usePersistentPremiumData';
import { ReverseGeocodeResponse, useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useSidePanelCloseHandling } from '@/hooks/useSidePanelCloseHandling';
import { DashboardView } from '@/sidepanel/components/DashboardView';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GovEpcValidationMatch } from "../types/govEpcCertificate";
import {
  Address,
  ConfidenceLevels,
  EpcData,
  EpcDataSourceType,
  ExtractedPropertyScrapingData
} from "../types/property";

import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import { toast } from '@/hooks/use-toast';
import { useBackgroundMessageHandler } from "@/hooks/useBackgroundMessageHandler";
import { useChecklistAndDashboardData } from "@/hooks/useChecklistAndDashboardData";
import { useChecklistDisplayLogic } from "@/hooks/useChecklistDisplayLogic";
import { usePremiumFlow } from '@/hooks/usePremiumFlow';
import { useSecureAuthentication } from '@/hooks/useSecureAuthentication';
import PropertyAddressBar from './components/PropertyAddressBar/PropertyAddressBar';
import { generateAgentMessage, getValueClickHandler } from './helpers';
import SettingsBar from "./settingsbar/SettingsBar";

const LazyChecklistView = lazy(() =>
  import('@/sidepanel/components/ChecklistView').then(module => ({ default: module.ChecklistView }))
);
const LazyBuildingConfirmationDialog = lazy(() =>
  import('@/components/ui/Premium/BuildingConfirmationModal/BuildingConfirmationModal')
);
const LazyAgentMessageModal = lazy(() =>
  import('./components/AgentMessageModal').then(module => ({ default: module.AgentMessageModal }))
);
const LazyUpsellModal = lazy(() =>
  import('@/components/ui/Premium/UpsellModal').then(module => ({ default: module.UpsellModal }))
);
const LazyPremiumConfirmationModal = lazy(() =>
  import('@/components/ui/Premium/PremiumConfirmationModal').then(module => ({ default: module.PremiumConfirmationModal }))
);

const App: React.FC = () => {
  const queryClient = useQueryClient();

  const { isPropertyDataLoading, nonPropertyPageWarningMessage, currentPropertyId } = useBackgroundMessageHandler();
  const { isAuthenticated, signInRedirect } = useSecureAuthentication();

  const {
    data: propertyData,
    isLoading: isLoadingQueryPropertyData,
    error: queryPropertyDataError,
  } = useQuery<ExtractedPropertyScrapingData | undefined>({
    queryKey: [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
    queryFn: async ({ queryKey }) => {
      const currentData = queryClient.getQueryData<ExtractedPropertyScrapingData>(queryKey);
      return currentData ?? undefined;
    },
    enabled: !!currentPropertyId,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const epcDebugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isEpcDebugModeOn = process.env.IS_EPC_DEBUG_MODE === "true";
  const [currentView, setCurrentView] = useState<typeof VIEWS[keyof typeof VIEWS]>(
    VIEWS.DASHBOARD
  );
  const [crimeChartExpanded, setCrimeChartExpanded] = useState(false);
  const crimeContentRef = useRef<HTMLDivElement>(null);
  const [crimeContentHeight, setCrimeContentHeight] = useState(0);
  const [planningPermissionCardExpanded, setPlanningPermissionCardExpanded] = useState(false);
  const planningPermissionContentRef = useRef<HTMLDivElement>(null);
  const [planningPermissionContentHeight, setPlanningPermissionContentHeight] = useState(0);
  const [nearbyPlanningPermissionCardExpanded, setNearbyPlanningPermissionCardExpanded] = useState(false);
  const nearbyPlanningPermissionContentRef = useRef<HTMLDivElement>(null);
  const [nearbyPlanningPermissionContentHeight, setNearbyPlanningPermissionContentHeight] = useState(0);
  const [isAgentMessageModalOpen, setIsAgentMessageModalOpen] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");

  const handleSelectGovEpcSuggestion = useCallback((suggestion: GovEpcValidationMatch) => {
    if (!currentPropertyId) {
      console.error("Cannot select EPC suggestion: currentPropertyId is null.");
      return;
    }

    queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
      [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
      (oldData) => {
        if (!oldData) {
          console.error("Cannot select EPC suggestion: no existing property data in cache for ID:", currentPropertyId);
          return undefined;
        }

        const newData: ExtractedPropertyScrapingData = {
          ...oldData,
          address: {
            ...(oldData.address as Address),
            displayAddress: suggestion.retrievedAddress,
            addressConfidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
            isAddressConfirmedByUser: true,
            govEpcRegisterSuggestions: null,
          },
          epc: {
            ...(oldData.epc as EpcData),
            value: suggestion.retrievedRating,
            confidence: ConfidenceLevels.GOV_FIND_EPC_SERVICE_CONFIRMED,
            source: EpcDataSourceType.GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS,
            url: suggestion.certificateUrl,
            automatedProcessingResult: null,
            error: null,
          },
        };
        return newData;
      }
    );
  }, [queryClient, currentPropertyId]);

  const { activatePremiumSearch, isActivatingPremiumSearch } =
    usePersistentPremiumData();

  const {
    showUpsellModal,
    setShowUpsellModal,
    showPremiumConfirmationModal,
    setShowPremiumConfirmationModal,
    premiumConfirmationHandler,
    initiatePremiumActivationFlow,
    showBuildingValidationModal,
    setShowBuildingValidationModal,
    handleBuildingModalConfirmation,
  } = usePremiumFlow({
    isAuthenticated,
    currentPropertyId: currentPropertyId,
    propertyDataSource: propertyData,
    activatePremiumSearchFunction: activatePremiumSearch,
    showToast: toast,
  });

  const lat = propertyData?.locationCoordinates?.lat;
  const lng = propertyData?.locationCoordinates?.lng;
  const latStr = useMemo(() => lat?.toString() ?? '', [lat]);
  const lngStr = useMemo(() => lng?.toString() ?? '', [lng]);

  const handleReverseGeocodeSuccess = useCallback(
    (data: ReverseGeocodeResponse) => {
      console.log("Reverse geocode success (not updating cache):", data);
    },
    []
  );

  const reverseGeocodeQuery = useReverseGeocode(latStr, lngStr, handleReverseGeocodeSuccess);

  const crimeQuery = useCrimeScore(latStr, lngStr);

  useFeedbackAutoPrompt(currentPropertyId ?? null);

  const {
    propertyChecklistData,
    preprocessedData,
    categoryScores,
    overallScore,
    dataCoverageScoreData,
    premiumDataQuery,
  } = useChecklistAndDashboardData({
    propertyData: propertyData ?? null,
    crimeScoreQuery: crimeQuery,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    isAuthenticated,
  });

  const {
    filters,
    openGroups,
    filteredChecklistData,
    toggleFilter,
    toggleGroup,
    setOpenGroups
  } = useChecklistDisplayLogic({
    basePropertyChecklistData: propertyChecklistData,
  });

  const openNewTab = (url: string) => {
    chrome.tabs.create({ url });
  };

  const toggleCrimeChart = () => {
    setCrimeChartExpanded((prev) => !prev);
  };

  const togglePlanningPermissionCard = (expand?: boolean) => {
    setPlanningPermissionCardExpanded((prev) => (expand === undefined ? !prev : expand));
  };

  const toggleNearbyPlanningPermissionCard = (expand?: boolean) => {
    setNearbyPlanningPermissionCardExpanded((prev) => (expand === undefined ? !prev : expand));
  };

  useSidePanelCloseHandling();

  useEffect(function tellBackgroundSideBarOpened() {
    const queryParams = new URLSearchParams(location.search);
    const tabIdFromUrlString = queryParams.get("tabId");
    let tabId: number | undefined = tabIdFromUrlString ? parseInt(tabIdFromUrlString, 10) : undefined;

    const sendMessageWithTabId = (idToSend?: number) => {
      console.log(`[App.tsx] Sending SIDE_PANEL_OPENED to background. tabId: ${idToSend}`);
      chrome.runtime.sendMessage({ action: ActionEvents.SIDE_PANEL_OPENED, data: { tabId: idToSend } }, (response) => {
        console.log('SIDE_PANEL_OPENED response from background:', response, 'for tabId:', idToSend);
      });
    };

    if (tabId) {
      sendMessageWithTabId(tabId);
    } else {
      console.log("[App.tsx] tabId not in URL, querying for active tab.");
      sendMessageWithTabId(undefined);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id) {
          const activeTabId = tabs[0].id;
          console.log("[App.tsx] Found active tabId:", activeTabId);
          sendMessageWithTabId(activeTabId);
        } else {
          console.error("[App.tsx] Could not determine active tabId when not found in URL.");
          sendMessageWithTabId(undefined);
        }
      });
    }
  }, [])

  useEffect(function updateCrimeContentHeight() {
    if (crimeContentRef.current) {
      setCrimeContentHeight(crimeContentRef.current.scrollHeight);
    }
  }, [crimeChartExpanded, crimeQuery.data]);

  useEffect(function updatePlanningPermissionContentHeight() {
    if (planningPermissionContentRef.current) {
      setPlanningPermissionContentHeight(planningPermissionContentRef.current.scrollHeight);
    }
  }, [planningPermissionCardExpanded, preprocessedData]);

  useEffect(function updateNearbyPlanningPermissionContentHeight() {
    if (nearbyPlanningPermissionContentRef.current) {
      setNearbyPlanningPermissionContentHeight(nearbyPlanningPermissionContentRef.current.scrollHeight);
    }
  }, [nearbyPlanningPermissionCardExpanded, preprocessedData]);

  const handleEpcValueChange = useCallback((newValue: string) => {
    if (currentPropertyId && propertyData) {
      const currentEpcData = (propertyData.epc as EpcData) || {};
      const updatedEpcDataForCache: EpcData = {
        ...currentEpcData,
        value: newValue,
        confidence: ConfidenceLevels.USER_PROVIDED,
        source: EpcDataSourceType.USER_PROVIDED,
        error: null,
      };
      const updatedPropertyDataForCache: ExtractedPropertyScrapingData = {
        ...propertyData,
        epc: updatedEpcDataForCache,
      };
      queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
        [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
        updatedPropertyDataForCache
      );
    } else {
      console.warn("Cannot update RQ cache for EPC: currentPropertyId or propertyData missing.");
    }
  }, [queryClient, currentPropertyId, propertyData]);

  const handleGenerateMessageClick = useCallback(() => {
    const message = generateAgentMessage(propertyChecklistData);
    setAgentMessage(message);
    setIsAgentMessageModalOpen(true);
  }, [propertyChecklistData]);

  if (isLoadingQueryPropertyData || isPropertyDataLoading || (!propertyData && !nonPropertyPageWarningMessage) || isActivatingPremiumSearch) {
    return <SideBarLoading />;
  }

  if (nonPropertyPageWarningMessage || !propertyData) {
    return (
      <Alert type="warning" message={nonPropertyPageWarningMessage || "Property data could not be loaded."} />
    );
  }

  if (queryPropertyDataError) {
    return (
      <Alert type="error" message={`Error loading property data: ${queryPropertyDataError.message}`} />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <SettingsBar
        currentView={currentView}
        setCurrentView={setCurrentView}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        propertyChecklistData={propertyChecklistData.map(item => ({ group: item.checklistGroup }))}
        filters={filters}
        toggleFilter={toggleFilter}
        agentDetails={propertyData.agent}
        onGenerateMessageClick={handleGenerateMessageClick}
        onPremiumSearchClick={initiatePremiumActivationFlow}
      />

      {propertyData?.address && (
        <PropertyAddressBar
          address={propertyData.address}
          reverseGeocodedAddress={reverseGeocodeQuery.data?.address}
          onOpenAddressConfirmation={() => setShowBuildingValidationModal(true)}
          onSelectGovEpcSuggestion={handleSelectGovEpcSuggestion}
        />
      )}

      <main className="flex-1 overflow-y-auto p-4">
        {currentView === VIEWS.CHECKLIST && (
          <Suspense fallback={<SideBarLoading />}>
            <LazyChecklistView
              filteredChecklistData={filteredChecklistData}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              getValueClickHandler={getValueClickHandler}
              openNewTab={openNewTab}
              toggleCrimeChart={toggleCrimeChart}
              togglePlanningPermissionCard={togglePlanningPermissionCard}
              toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
              isPremiumDataFetched={premiumDataQuery.isFetched}
              epcBandData={preprocessedData.finalEpcBandData}
              handleEpcValueChange={handleEpcValueChange}
              isEpcDebugModeOn={isEpcDebugModeOn}
              epcDebugCanvasRef={epcDebugCanvasRef}
              crimeQuery={crimeQuery}
              crimeChartExpanded={crimeChartExpanded}
              crimeContentRef={crimeContentRef}
              crimeContentHeight={crimeContentHeight}
              planningPermissionCardExpanded={planningPermissionCardExpanded}
              planningPermissionContentRef={planningPermissionContentRef}
              planningPermissionContentHeight={planningPermissionContentHeight}
              nearbyPlanningPermissionCardExpanded={nearbyPlanningPermissionCardExpanded}
              nearbyPlanningPermissionContentRef={nearbyPlanningPermissionContentRef}
              nearbyPlanningPermissionContentHeight={nearbyPlanningPermissionContentHeight}
              onTriggerPremiumFlow={initiatePremiumActivationFlow}
              premiumStreetDataQuery={premiumDataQuery}
            />
          </Suspense>
        )}

        {currentView === VIEWS.DASHBOARD && (
          <DashboardView
            checklistsData={propertyChecklistData}
            categoryScores={categoryScores}
            overallScore={overallScore}
            getValueClickHandler={getValueClickHandler}
            dataCoverageScoreData={dataCoverageScoreData}
            crimeQuery={crimeQuery}
            crimeChartExpanded={crimeChartExpanded}
            toggleCrimeChart={toggleCrimeChart}
            crimeContentRef={crimeContentRef}
            crimeContentHeight={crimeContentHeight}
            planningPermissionCardExpanded={planningPermissionCardExpanded}
            togglePlanningPermissionCard={togglePlanningPermissionCard}
            planningPermissionContentRef={planningPermissionContentRef}
            planningPermissionContentHeight={planningPermissionContentHeight}
            nearbyPlanningPermissionCardExpanded={nearbyPlanningPermissionCardExpanded}
            toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
            nearbyPlanningPermissionContentRef={nearbyPlanningPermissionContentRef}
            nearbyPlanningPermissionContentHeight={nearbyPlanningPermissionContentHeight}
            onTriggerPremiumFlow={initiatePremiumActivationFlow}
            isPremiumDataFetched={premiumDataQuery.isFetched}
            epcBandData={preprocessedData.finalEpcBandData}
            epcDebugCanvasRef={epcDebugCanvasRef}
            isEpcDebugModeOn={isEpcDebugModeOn}
            handleEpcValueChange={handleEpcValueChange}
            isLoading={isLoadingQueryPropertyData || premiumDataQuery.isLoading}
            premiumStreetDataQuery={premiumDataQuery}
            openNewTab={openNewTab}
          />
        )}
      </main>

      {showBuildingValidationModal && (
        <Suspense fallback={null}>
          <LazyBuildingConfirmationDialog
            open={showBuildingValidationModal}
            onOpenChange={setShowBuildingValidationModal}
            addressData={propertyData?.address ?? null}
            handleConfirm={handleBuildingModalConfirmation}
            reverseGeocodedAddress={reverseGeocodeQuery.data?.address ?? null}
            currentEpcRating={propertyData?.epc?.value ?? null}
          />
        </Suspense>
      )}
      {showUpsellModal && (
        <Suspense fallback={null}>
          <LazyUpsellModal
            open={showUpsellModal}
            onOpenChange={setShowUpsellModal}
            onSignInClick={signInRedirect}
          />
        </Suspense>
      )}
      {showPremiumConfirmationModal && isAuthenticated && (
        <Suspense fallback={null}>
          <LazyPremiumConfirmationModal
            open={showPremiumConfirmationModal}
            onOpenChange={setShowPremiumConfirmationModal}
            onConfirmPremiumSearch={premiumConfirmationHandler}
            isAddressConfirmed={propertyData?.address?.isAddressConfirmedByUser ?? false}
          />
        </Suspense>
      )}
      {isAgentMessageModalOpen && (
        <Suspense fallback={null}>
          <LazyAgentMessageModal
            isOpen={isAgentMessageModalOpen}
            onClose={() => setIsAgentMessageModalOpen(false)}
            message={agentMessage}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;


