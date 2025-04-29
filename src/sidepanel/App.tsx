import DevTools from '@/components/DevTools';
import Alert from '@/components/ui/Alert';
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import { ActionEvents } from '@/constants/actionEvents';
import VIEWS from '@/constants/views';
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { usePremiumStreetData } from '@/hooks/usePremiumStreetData';
import { ReverseGeocodeResponse, useReverseGeocode } from '@/hooks/useReverseGeocode';
import { DashboardView } from '@/sidepanel/components/DashboardView';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfidenceLevels,
  EpcData,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
  PropertyDataListItem
} from "../types/property";

import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import { useBackgroundMessageHandler } from "@/hooks/useBackgroundMessageHandler";
import { useChecklistAndDashboardData } from "@/hooks/useChecklistAndDashboardData";
import { useChecklistDisplayLogic } from "@/hooks/useChecklistDisplayLogic";
import { usePremiumFlow } from '@/hooks/usePremiumFlow';
import { useSecureAuthentication } from '@/hooks/useSecureAuthentication';
import { ChecklistViewProps } from "@/sidepanel/components/ChecklistView";
import {
  generateAgentMessage,
  getValueClickHandler
} from "./helpers";
import SettingsBar from "./settingsbar/SettingsBar";

const LazyChecklistView = lazy(() =>
  import('@/sidepanel/components/ChecklistView').then(module => ({ default: module.ChecklistView as React.FC<ChecklistViewProps> }))
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

  const { isPropertyDataLoading, nonPropertyPageWarningMessage, currentPropertyId } = useBackgroundMessageHandler(
    queryClient
  );
  const { isAuthenticated, isCheckingAuth } = useSecureAuthentication();

  const {
    data: propertyData,
    isLoading: isLoadingQueryPropertyData,
    error: queryPropertyDataError,
    isSuccess: isQueryPropertyDataSuccess,
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
  const [showBuildingValidationModal, setShowBuildingValidationModal] = useState(false);
  const [isAgentMessageModalOpen, setIsAgentMessageModalOpen] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [premiumSearchActivated, setPremiumSearchActivated] = useState(false);

  // --- Hooks depending on propertyId or propertyData ---
  const premiumStreetDataQuery = usePremiumStreetData({
    isAddressConfirmedByUser: propertyData?.address?.isAddressConfirmedByUser ?? false,
    premiumSearchActivated: premiumSearchActivated,
    address: propertyData?.address?.displayAddress ?? '',
    postcode: propertyData?.address?.postcode ?? ''
  });

  // --- Handler to activate premium search ---
  const handleConfirmAndActivate = useCallback(() => {
    setPremiumSearchActivated(true);
  }, []);

  // --- Premium Flow Hook ---
  const {
    triggerPremiumFlow,
    showUpsellModal,
    setShowUpsellModal,
    showPremiumConfirmationModal,
    setShowPremiumConfirmationModal,
    premiumConfirmationHandler,
    notifyAddressConfirmed,
  } = usePremiumFlow({
    isAuthenticated,
    isAddressConfirmed: propertyData?.address?.isAddressConfirmedByUser ?? false, // Use query data
    openAddressConfirmationModal: useCallback(() => setShowBuildingValidationModal(true), []),
    onConfirmAndActivate: handleConfirmAndActivate,
  });

  const lat = propertyData?.locationCoordinates?.lat;
  const lng = propertyData?.locationCoordinates?.lng;
  const latStr = useMemo(() => lat?.toString() ?? '', [lat]);
  const lngStr = useMemo(() => lng?.toString() ?? '', [lng]);

  const handleReverseGeocodeSuccess = useCallback(
    (data: ReverseGeocodeResponse) => {
      if (currentPropertyId) {
        queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
          [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
          (oldData) => oldData ? { ...oldData, address: { ...oldData.address, displayAddress: data.address, isAddressConfirmedByUser: false } } : undefined
        );
      } else {
        console.warn("Cannot update RQ cache for reverse geocode: currentPropertyId missing.")
      }
    },
    [queryClient, currentPropertyId]
  );

  useReverseGeocode(latStr, lngStr, handleReverseGeocodeSuccess);

  const crimeQuery = useCrimeScore(latStr, lngStr);

  useFeedbackAutoPrompt(currentPropertyId ?? null);

  const {
    propertyChecklistData,
    preprocessedData,
    categoryScores,
    overallScore,
    dataCoverageScoreData
  } = useChecklistAndDashboardData({
    propertyData: propertyData ?? null,
    crimeScoreQuery: crimeQuery,
    premiumStreetDataQuery,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  const {
    filters,
    openGroups,
    filteredChecklistData,
    toggleFilter,
    toggleGroup,
    setOpenGroups
  } = useChecklistDisplayLogic(propertyChecklistData);

  const openNewTab = (url: string) => {
    chrome.tabs.create({ url });
  };

  const toggleCrimeChart = () => {
    setCrimeChartExpanded((prev) => !prev);
  };

  const togglePlanningPermissionCard = () => {
    setPlanningPermissionCardExpanded((prev) => !prev);
  };

  const toggleNearbyPlanningPermissionCard = () => {
    setNearbyPlanningPermissionCardExpanded((prev) => !prev);
  };

  useEffect(function tellBackgroundSideBarOpened() {
    chrome.runtime.sendMessage({ action: ActionEvents.SIDE_PANEL_OPENED }, (response) => {
      console.log('SIDE_PANEL_OPENED response:', response);
    });
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
  }, [planningPermissionCardExpanded, premiumStreetDataQuery.data]);

  useEffect(function updateNearbyPlanningPermissionContentHeight() {
    if (nearbyPlanningPermissionContentRef.current) {
      setNearbyPlanningPermissionContentHeight(nearbyPlanningPermissionContentRef.current.scrollHeight);
    }
  }, [nearbyPlanningPermissionCardExpanded, premiumStreetDataQuery.data]);

  const handleBuildingNameOrNumberConfirmation = (buildingNameOrNumber: string) => {
    if (currentPropertyId) {
      queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
        [REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId],
        (oldData) => oldData ? { ...oldData, address: { ...oldData.address, displayAddress: buildingNameOrNumber, isAddressConfirmedByUser: true } } : undefined
      );
    } else {
      console.warn("Cannot update RQ cache for building confirmation: currentPropertyId missing.")
    }
    setShowBuildingValidationModal(false);
    notifyAddressConfirmed();
  }

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

  // --- Loading Checks ---
  if (nonPropertyPageWarningMessage) {
    return <Alert type="warning" message={nonPropertyPageWarningMessage} />;
  }
  if (isCheckingAuth || (!!currentPropertyId && isLoadingQueryPropertyData)) {
    return <SideBarLoading />;
  }
  if (queryPropertyDataError) {
    return <Alert type="error" message={`Error loading property data: ${queryPropertyDataError.message}`} />;
  }

  const isPremiumDataFetched = premiumStreetDataQuery.isFetched;

  if (!propertyData?.propertyId) {
    return (
      <Alert
        type="info"
        message="Waiting for property data or navigate to a Rightmove property page."
      />
    );
  }

  if (isPropertyDataLoading) {
    <Alert
      type="info"
      message="Background script loading."
    />
  }

  // --- Main Render Logic --- 
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SettingsBar
        toggleFilter={toggleFilter}
        filters={filters}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        propertyChecklistData={propertyChecklistData.map((item: PropertyDataListItem) => ({ group: item.checklistGroup }))}
        agentDetails={propertyData.agent}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onGenerateMessageClick={handleGenerateMessageClick}
        onPremiumSearchClick={triggerPremiumFlow}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow p-4 overflow-y-auto">
        {currentView === VIEWS.DASHBOARD && categoryScores
          ? (
            <DashboardView
              checklistsData={propertyChecklistData}
              categoryScores={categoryScores}
              overallScore={overallScore}
              dataCoverageScoreData={dataCoverageScoreData}
              isLoading={isLoadingQueryPropertyData}
              isPremiumDataFetched={isPremiumDataFetched}
              processedEpcResult={preprocessedData.processedEpcResult}
              epcDebugCanvasRef={epcDebugCanvasRef}
              isEpcDebugModeOn={isEpcDebugModeOn}
              handleEpcValueChange={handleEpcValueChange}
              getValueClickHandler={getValueClickHandler}
              openNewTab={openNewTab}
              toggleCrimeChart={toggleCrimeChart}
              togglePlanningPermissionCard={togglePlanningPermissionCard}
              toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
              crimeQuery={crimeQuery}
              premiumStreetDataQuery={premiumStreetDataQuery}
              crimeChartExpanded={crimeChartExpanded}
              crimeContentRef={crimeContentRef}
              crimeContentHeight={crimeContentHeight}
              planningPermissionCardExpanded={planningPermissionCardExpanded}
              planningPermissionContentRef={planningPermissionContentRef}
              planningPermissionContentHeight={planningPermissionContentHeight}
              nearbyPlanningPermissionCardExpanded={nearbyPlanningPermissionCardExpanded}
              nearbyPlanningPermissionContentRef={nearbyPlanningPermissionContentRef}
              nearbyPlanningPermissionContentHeight={nearbyPlanningPermissionContentHeight}
              onTriggerPremiumFlow={triggerPremiumFlow}
            />
          ) : (
            <Suspense fallback={<SideBarLoading />}>
              <LazyChecklistView
                filteredChecklistData={filteredChecklistData}
                getValueClickHandler={getValueClickHandler}
                handleEpcValueChange={handleEpcValueChange}
                openNewTab={openNewTab}
                toggleCrimeChart={toggleCrimeChart}
                togglePlanningPermissionCard={togglePlanningPermissionCard}
                toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
                isPremiumDataFetched={isPremiumDataFetched}
                processedEpcResult={preprocessedData.processedEpcResult ?? undefined}
                epcDebugCanvasRef={epcDebugCanvasRef}
                isEpcDebugModeOn={isEpcDebugModeOn}
                onTriggerPremiumFlow={triggerPremiumFlow}
                crimeQuery={crimeQuery}
                premiumStreetDataQuery={premiumStreetDataQuery}
                crimeChartExpanded={crimeChartExpanded}
                crimeContentRef={crimeContentRef}
                crimeContentHeight={crimeContentHeight}
                planningPermissionCardExpanded={planningPermissionCardExpanded}
                planningPermissionContentRef={planningPermissionContentRef}
                planningPermissionContentHeight={planningPermissionContentHeight}
                nearbyPlanningPermissionCardExpanded={nearbyPlanningPermissionCardExpanded}
                nearbyPlanningPermissionContentRef={nearbyPlanningPermissionContentRef}
                nearbyPlanningPermissionContentHeight={nearbyPlanningPermissionContentHeight}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
              />
            </Suspense>
          )
        }
      </div>

      {/* Modals */}
      {showBuildingValidationModal && (
        <Suspense fallback={null}>
          <LazyBuildingConfirmationDialog
            open={showBuildingValidationModal}
            onOpenChange={setShowBuildingValidationModal}
            suggestedBuildingNameOrNumber={propertyData.address.displayAddress ?? ""}
            handleConfirm={handleBuildingNameOrNumberConfirmation}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <LazyAgentMessageModal
          isOpen={isAgentMessageModalOpen}
          onClose={() => setIsAgentMessageModalOpen(false)}
          message={agentMessage}
        />
      </Suspense>
      {showUpsellModal && (
        <Suspense fallback={null}>
          <LazyUpsellModal
            open={showUpsellModal}
            onOpenChange={setShowUpsellModal}
          />
        </Suspense>
      )}
      {showPremiumConfirmationModal && isAuthenticated && (
        <Suspense fallback={null}>
          <LazyPremiumConfirmationModal
            open={showPremiumConfirmationModal}
            onOpenChange={setShowPremiumConfirmationModal}
            isAddressConfirmed={propertyData?.address?.isAddressConfirmedByUser ?? false}
            onConfirmPremiumSearch={premiumConfirmationHandler}
          />
        </Suspense>
      )}
      <DevTools />
    </div>
  );
};

export default App;
