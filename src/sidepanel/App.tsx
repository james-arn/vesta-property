import DevTools from '@/components/DevTools';
import Alert from '@/components/ui/Alert';
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import { ActionEvents } from '@/constants/actionEvents';
import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import VIEWS from '@/constants/views';
import { usePropertyData } from '@/context/propertyDataContext';
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { usePremiumStreetData } from '@/hooks/usePremiumStreetData';
import { ReverseGeocodeResponse, useReverseGeocode } from '@/hooks/useReverseGeocode';
import { DashboardView } from '@/sidepanel/components/DashboardView';
import { PropertyReducerActionTypes } from "@/sidepanel/propertyReducer";
import { useQueryClient } from '@tanstack/react-query';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfidenceLevels,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
  PropertyDataListItem
} from "../types/property";

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
  // 1. We start by getting the scraped proerty data from the DOM (from contentscript.ts via background.ts)
  const { propertyData, dispatch } = usePropertyData();
  const queryClient = useQueryClient();
  const { isPropertyDataLoading, nonPropertyPageWarningMessage } =
    useBackgroundMessageHandler(dispatch, queryClient);
  const { isAuthenticated, isCheckingAuth } = useSecureAuthentication();

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


  const premiumStreetDataQuery = usePremiumStreetData({
    isAddressConfirmedByUser: propertyData.address.isAddressConfirmedByUser,
    premiumSearchActivated: premiumSearchActivated,
    address: propertyData.address.displayAddress ?? '',
    postcode: propertyData.address.postcode ?? ''
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
    isAddressConfirmed: propertyData.address.isAddressConfirmedByUser,
    openAddressConfirmationModal: useCallback(() => setShowBuildingValidationModal(true), []),
    onConfirmAndActivate: handleConfirmAndActivate,
  });

  // Destructure coords and immediately calculate memoized strings
  const { lat, lng } = propertyData.locationCoordinates;
  const latStr = useMemo(() => lat?.toString() ?? '', [lat]);
  const lngStr = useMemo(() => lng?.toString() ?? '', [lng]);

  // 2. Reverse geocode is used to get building name/number of the property based on agents co-ordinates
  const handleReverseGeocodeSuccess = useCallback(
    (data: ReverseGeocodeResponse) => {
      dispatch({
        type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS,
        payload: {
          displayAddress: data.address,
          isAddressConfirmedByUser: false,
        },
      });
    },
    [dispatch]
  );

  useReverseGeocode(latStr, lngStr, handleReverseGeocodeSuccess);

  // 4. Once confirmed address state is updated, Premium (paid) street data uses confirmed address to get the enhanced data of the property
  const crimeQuery = useCrimeScore(
    latStr,
    lngStr
  );

  useFeedbackAutoPrompt(propertyData.propertyId);

  const {
    propertyChecklistData,
    preprocessedData,
    categoryScores,
    overallScore,
    dataCoverageScoreData
  } = useChecklistAndDashboardData({
    propertyData,
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

  // --- Redefine Handlers needed by views --- 
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
    dispatch({
      type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS,
      payload: { displayAddress: buildingNameOrNumber, isAddressConfirmedByUser: true },
    });
    setShowBuildingValidationModal(false);
    notifyAddressConfirmed();
  }

  const handleEpcValueChange = useCallback((newValue: string) => {
    const updatedEpcPayload = { value: newValue };
    dispatch({ type: PropertyReducerActionTypes.UPDATE_EPC_VALUE, payload: updatedEpcPayload });

    if (propertyData.propertyId) {
      queryClient.setQueryData<ExtractedPropertyScrapingData | undefined>(
        [REACT_QUERY_KEYS.PROPERTY_DATA, propertyData.propertyId],
        (oldData) => {
          if (!oldData) {
            console.warn("Tried to update EPC cache, but no existing data found for propertyId:", propertyData.propertyId);
            return undefined;
          }
          return {
            ...oldData,
            epc: {
              ...oldData.epc,
              value: newValue,
              confidence: ConfidenceLevels.USER_PROVIDED,
              source: oldData.epc?.source ?? EpcDataSourceType.NONE,
              url: oldData.epc?.url ?? null,
              displayUrl: oldData.epc?.displayUrl ?? null,
              scores: oldData.epc?.scores ?? null,
              error: oldData.epc?.error ?? null,
            }
          };
        }
      );
    }
  }, [dispatch, queryClient, propertyData.propertyId]);

  const handleGenerateMessageClick = useCallback(() => {
    const message = generateAgentMessage(propertyChecklistData);
    setAgentMessage(message);
    setIsAgentMessageModalOpen(true);
  }, [propertyChecklistData]);

  if (nonPropertyPageWarningMessage) {
    return <Alert type="warning" message={nonPropertyPageWarningMessage} />;
  }
  if (isPropertyDataLoading || isCheckingAuth) {
    return <SideBarLoading />;
  }

  const isPremiumDataFetched = premiumStreetDataQuery.isFetched;

  if (!propertyData.propertyId) {
    // If no property ID, show the info alert
    return (
      <Alert
        type="info"
        message="Navigate to a property page on rightmove.co.uk to get started."
      />
    );
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
              isLoading={isPropertyDataLoading}
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
                openNewTab={openNewTab}
                toggleCrimeChart={toggleCrimeChart}
                togglePlanningPermissionCard={togglePlanningPermissionCard}
                toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
                handleEpcValueChange={handleEpcValueChange}
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
            isAddressConfirmed={propertyData.address.isAddressConfirmedByUser}
            onConfirmPremiumSearch={premiumConfirmationHandler}
          />
        </Suspense>
      )}
      <DevTools />
    </div>
  );
};

export default App;
