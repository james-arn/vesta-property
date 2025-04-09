import DevTools from '@/components/DevTools';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import { ActionEvents } from '@/constants/actionEvents';
import { emptyPropertyData } from '@/constants/emptyPropertyData';
import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import VIEWS from '@/constants/views';
import { usePropertyData } from '@/context/propertyDataContext';
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { usePremiumStreetData } from '@/hooks/usePremiumStreetData';
import { useProcessedEpcData } from '@/hooks/useProcessedEpcData';
import { ReverseGeocodeResponse, useReverseGeocode } from '@/hooks/useReverseGeocode';
import { INITIAL_EPC_RESULT_STATE } from "@/lib/epcProcessing";
import { DashboardView } from '@/sidepanel/components/DashboardView';
import { PropertyReducerActionTypes } from "@/sidepanel/propertyReducer";
import { useQueryClient } from '@tanstack/react-query';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExtractedPropertyScrapingData,
  PropertyDataList
} from "../types/property";

import {
  extractPropertyIdFromUrl,
  filterChecklistToAllAskAgentOnlyItems,
  generateAgentMessage,
  getValueClickHandler
} from "./helpers";

import { generatePropertyChecklist } from "./propertychecklist/propertyChecklist";
import SettingsBar from "./settingsbar/SettingsBar";
const LazyBuildingConfirmationDialog = lazy(() =>
  import('@/components/ui/Premium/BuildingConfirmationModal/BuildingConfirmationModal')
);
const LazyAgentMessageModal = lazy(() =>
  import('./components/AgentMessageModal').then(module => ({ default: module.AgentMessageModal }))
);
const LazyChecklistView = lazy(() =>
  import('@/sidepanel/components/ChecklistView').then(module => ({ default: module.ChecklistView }))
);

const App: React.FC = () => {
  // 1. Property data starts empty and is updated via rightmove scrape
  const { propertyData, dispatch } = usePropertyData()
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);
  const [nonPropertyPageWarningMessage, setNonPropertyPageWarningMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    showAskAgentOnly: false,
  });
  const epcDebugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isEpcDebugModeOn = process.env.IS_EPC_DEBUG_MODE === "true";

  const [currentView, setCurrentView] = useState<typeof VIEWS[keyof typeof VIEWS]>(
    VIEWS.DASHBOARD
  );

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

  // 3. On premium click, building validation modal is used to confirm the building name/number of the property
  const [showBuildingValidationModal, setShowBuildingValidationModal] = useState(false);

  // 4. Once confirmed address state is updated, Premium (paid) street data uses confirmed address to get the enhanced data of the property
  const premiumStreetDataQuery = usePremiumStreetData(
    propertyData.address.isAddressConfirmedByUser,
    propertyData.address.displayAddress ?? '',
    propertyData.address.postcode ?? ''
  );
  const crimeQuery = useCrimeScore(
    latStr,
    lngStr
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

  useFeedbackAutoPrompt(propertyData.propertyId);
  const queryClient = useQueryClient();

  const {
    processedEpcResult,
  } = useProcessedEpcData({
    initialEpcData: propertyData.epc,
    epcUrl: propertyData.epc?.url,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
  });

  useEffect(function tellBackgroundSideBarOpened() {
    chrome.runtime.sendMessage({ action: ActionEvents.SIDE_PANEL_OPENED }, (response) => {
      console.log('SIDE_PANEL_OPENED response:', response);
    });
  }, [])

  useEffect(function handleMessages() {
    const handleMessage = (
      message: { action: string; data?: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      console.log("[Side Panel] Received message:", message);

      if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
        console.log('TAB_CHANGED_OR_EXTENSION_OPENED hit')
        const propertyIdFromTabUrl = extractPropertyIdFromUrl(message.data);
        // If no valid property ID is found, show the warning message.
        if (!propertyIdFromTabUrl) {
          console.log('!propertyIdFromTabUrl')
          setNonPropertyPageWarningMessage("Please open a property page on rightmove.co.uk.");
          setIsPropertyDataLoading(false);
          dispatch({ type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA, payload: emptyPropertyData });
        } else {
          // URL is valid – clear any existing warning and try to load cached data.
          setNonPropertyPageWarningMessage(null);
          setIsPropertyDataLoading(true);
          const cachedPropertyData = queryClient.getQueryData<ExtractedPropertyScrapingData>([
            REACT_QUERY_KEYS.PROPERTY_DATA,
            propertyIdFromTabUrl,
          ]);
          if (cachedPropertyData) {
            console.log('cached')
            dispatch({ type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA, payload: cachedPropertyData });
            setIsPropertyDataLoading(false);
          } else {
            console.log('not-cached')
            dispatch({ type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA, payload: emptyPropertyData });
          }
        }
      } else if (message.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        // Once data is updated, update cache
        queryClient.setQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, message.data.propertyId], message.data);
        dispatch({ type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA, payload: message.data });
        setIsPropertyDataLoading(false);
        setNonPropertyPageWarningMessage(null);
        console.log("[Side Panel] Property data updated:", message.data);
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        console.log('showing warning')
        setNonPropertyPageWarningMessage(message.data || null);
        setIsPropertyDataLoading(false);
        dispatch({ type: PropertyReducerActionTypes.SET_FULL_PROPERTY_DATA, payload: emptyPropertyData });
        console.log("[Side Panel] Warning message set:", message.data);
      }
      sendResponse({ status: "acknowledged", action: message.action });
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [queryClient, dispatch]);

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

  // --- Base Checklist Data Generation (Now uses processed EPC data) ---
  const basePropertyChecklistData = useMemo(() => generatePropertyChecklist(
    propertyData, // Pass the base property data
    crimeQuery,
    premiumStreetDataQuery,
    processedEpcResult ?? INITIAL_EPC_RESULT_STATE
  ), [propertyData, crimeQuery, premiumStreetDataQuery, processedEpcResult]);

  // No need to derive displayChecklistData separately anymore,
  // generatePropertyChecklist will use the latest EPC data directly.
  const displayChecklistData = basePropertyChecklistData;

  // --- Filtering and Grouping Logic (now depends on displayChecklistData) ---
  const initialOpenGroups = useMemo(() => displayChecklistData.reduce(
    (acc, item) => {
      if (item.group) {
        acc[item.group] = true;
      }
      return acc;
    },
    {} as Record<string, boolean>
  ), [displayChecklistData]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);

  const toggleGroup = useCallback((group: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }, []);

  let lastGroup = "";

  const openNewTab = (url: string) => {
    chrome.tabs.create({ url });
  };

  const toggleFilter = (filterName: keyof typeof filters) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };

  const applyFilters = useCallback(
    (checklist: PropertyDataList[], currentFilters: typeof filters) => {
      let filteredList = [...checklist]; // Start with a copy

      if (currentFilters.showAskAgentOnly) {
        filteredList = filterChecklistToAllAskAgentOnlyItems(filteredList);
      }

      // Future filters can be added here...
      // if (currentFilters.someOtherFilter) { ... }

      return filteredList;
    },
    [] // Dependencies for useCallback if filters logic changes
  );

  const filteredChecklistData = useMemo(
    () => applyFilters(displayChecklistData, filters),
    [displayChecklistData, filters, applyFilters]
  );

  const toggleCrimeChart = () => {
    setCrimeChartExpanded((prev) => !prev);
  };

  const togglePlanningPermissionCard = () => {
    setPlanningPermissionCardExpanded((prev) => !prev);
  };

  const toggleNearbyPlanningPermissionCard = () => {
    setNearbyPlanningPermissionCardExpanded((prev) => !prev);
  };

  const renderedGroupsSet = new Set<string>();

  const renderGroupHeading = useCallback((group: string) => {
    if (renderedGroupsSet.has(group)) return null;
    renderedGroupsSet.add(group);

    const itemCount = filteredChecklistData.filter(item => item.group === group).length;
    return (
      <li
        className="mt-5 font-bold text-base cursor-pointer flex justify-between items-center"
        onClick={() => toggleGroup(group)}
      >
        <span>{group} {!openGroups[group] && `(${itemCount})`}</span>
        <span className="mr-2">{openGroups[group] ? "▼" : "▲"}</span>
      </li>
    );
  }, [filteredChecklistData, openGroups, toggleGroup]);

  const handleBuildingNameOrNumberConfirmation = (buildingNameOrNumber: string) => {
    dispatch({
      type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS,
      payload: { displayAddress: buildingNameOrNumber, isAddressConfirmedByUser: true },
    });
  }

  const handleEpcValueChange = useCallback((newValue: string) => {
    dispatch({ type: PropertyReducerActionTypes.UPDATE_EPC_VALUE, payload: { value: newValue } });
  }, [dispatch]);

  const [isAgentMessageModalOpen, setIsAgentMessageModalOpen] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");

  const handleGenerateMessageClick = useCallback(() => {
    const message = generateAgentMessage(displayChecklistData);
    setAgentMessage(message);
    setIsAgentMessageModalOpen(true);
  }, [displayChecklistData]);

  if (nonPropertyPageWarningMessage) {
    return <Alert type="warning" message={nonPropertyPageWarningMessage} />;
  }
  if (isPropertyDataLoading) {
    return <SideBarLoading />;
  }

  const isPremiumDataFetched = premiumStreetDataQuery.isSuccess;

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
        toggleFilter={() => toggleFilter('showAskAgentOnly')}
        filters={filters}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        propertyChecklistData={displayChecklistData}
        agentDetails={propertyData.agent}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onGenerateMessageClick={handleGenerateMessageClick}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow p-4 overflow-y-auto">
        {currentView === VIEWS.DASHBOARD
          ? (
            <DashboardView checklistsData={displayChecklistData} />
          ) : (
            <Suspense fallback={<LoadingSpinner />}>
              <LazyChecklistView
                filteredChecklistData={filteredChecklistData}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                getValueClickHandler={getValueClickHandler}
                openNewTab={openNewTab}
                toggleCrimeChart={toggleCrimeChart}
                togglePlanningPermissionCard={togglePlanningPermissionCard}
                toggleNearbyPlanningPermissionCard={toggleNearbyPlanningPermissionCard}
                isPremiumDataFetched={isPremiumDataFetched}
                processedEpcResult={processedEpcResult}
                handleEpcValueChange={handleEpcValueChange}
                isEpcDebugModeOn={isEpcDebugModeOn}
                epcDebugCanvasRef={epcDebugCanvasRef}
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
              />
            </Suspense>
          )
        }
      </div>

      {/* Modals etc. */}
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
      <DevTools />
    </div>
  );
};

export default App;
