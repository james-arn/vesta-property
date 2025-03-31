import DevTools from '@/components/DevTools';
import Alert from '@/components/ui/Alert';
import { Button } from '@/components/ui/button';
import { ChecklistItem } from "@/components/ui/ChecklistItem";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import { emptyPropertyData } from "@/constants/emptyPropertyData";
import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import { STEPS } from "@/constants/steps";
import { usePropertyData } from '@/context/propertyDataContext';
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { usePremiumStreetData } from '@/hooks/usePremiumStreetData';
import { ReverseGeocodeResponse, useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useSecureAuthentication } from '@/hooks/useSecureAuthentication';
import { PropertyReducerActionTypes } from "@/sidepanel/propertyReducer";
import { FillRightmoveContactFormMessage } from "@/types/messages";
import { useQueryClient } from '@tanstack/react-query';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionEvents } from "../constants/actionEvents";
import {
  DataStatus,
  ExtractedPropertyScrapingData,
  PropertyDataList
} from "../types/property";
import {
  extractPropertyIdFromUrl,
  filterChecklistToAllAskAgentOnlyItems,
  getValueClickHandler
} from "./helpers";
import { generatePropertyChecklist } from "./propertychecklist/propertyChecklist";
import SettingsBar from "./settingsbar/SettingsBar";
const LazyBuildingConfirmationDialog = lazy(() =>
  import('@/components/ui/Premium/BuildingConfirmationModal/BuildingConfirmationModal')
);
const LazyCrimePieChart = lazy(() => import('@/components/ui/CrimePieChart'));
const LazyPlanningPermissionCard = lazy(() => import('@/components/ui/Premium/PlanningPermission/PlanningPermissionCard'));

const App: React.FC = () => {
  // 1. Property data starts empty and is updated via rightmove scrape
  const { propertyData, dispatch } = usePropertyData()
  const { isAuthenticated } = useSecureAuthentication();
  const [nonPropertyPageWarningMessage, setNonPropertyPageWarningMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    showAskAgentOnly: false,
  });
  const [currentStep, setCurrentStep] = useState<keyof typeof STEPS>(
    STEPS.INITIAL_REVIEW
  );
  const [selectedWarningItems, setSelectedWarningItems] = useState<
    PropertyDataList[]
  >([]);
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);

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

  useFeedbackAutoPrompt(propertyData.propertyId, currentStep);
  const queryClient = useQueryClient();


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
          console.log('urlvalid')
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
      } else if (message.action === ActionEvents.RIGHTMOVE_SIGN_IN_PAGE_OPENED) {
        console.log("[Side Panel] RIGHTMOVE_SIGN_IN_PAGE_OPENED message received");
        setCurrentStep(STEPS.RIGHTMOVE_SIGN_IN);
      } else if (message.action === ActionEvents.RIGHTMOVE_SIGN_IN_COMPLETED) {
        console.log("[Side Panel] RIGHTMOVE_SIGN_IN_COMPLETED message received");
        setCurrentStep(STEPS.REVIEW_MESSAGE);
      } else if (message.action === ActionEvents.AGENT_CONTACT_FORM_SUBMITTED) {
        console.log("[Side Panel] AGENT_CONTACT_FORM_SUBMITTED message received");
        setCurrentStep(STEPS.EMAIL_SENT);
      }

      sendResponse({ status: "acknowledged", action: message.action });
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [queryClient]);

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

  const propertyChecklistData = generatePropertyChecklist(propertyData, crimeQuery, premiumStreetDataQuery);

  const initialOpenGroups = propertyChecklistData.reduce(
    (acc, item) => {
      acc[item.group] = true;
      return acc;
    },
    {} as { [key: string]: boolean }
  );
  const [openChecklistGroups, setOpenChecklistGroups] = useState<{ [key: string]: boolean }>(
    initialOpenGroups
  );

  const toggleGroup = (group: string) => {
    setOpenChecklistGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

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

  const applyFilters = (
    checklist: PropertyDataList[],
    filters: { showAskAgentOnly: boolean }
  ) => {
    let filtered = checklist;
    if (filters.showAskAgentOnly) {
      filtered = filtered.filter(
        (item: PropertyDataList) => item.status === DataStatus.ASK_AGENT
      );
    }
    // Apply more filters here
    return filtered;
  };

  const filteredChecklist = applyFilters(propertyChecklistData, filters);
  const askAgentItems =
    filterChecklistToAllAskAgentOnlyItems(filteredChecklist);

  const checklistToRender =
    currentStep === STEPS.SELECT_ISSUES ? askAgentItems : filteredChecklist;

  const handleNextStep = () => {
    setCurrentStep((prevStep) => {
      switch (prevStep) {
        case STEPS.INITIAL_REVIEW:
          setSelectedWarningItems(askAgentItems);
          return STEPS.SELECT_ISSUES;
        case STEPS.SELECT_ISSUES:
          const emailAgentUrl = propertyData.agent?.contactUrl;
          if (emailAgentUrl) {
            chrome.runtime.sendMessage<
              FillRightmoveContactFormMessage,
              ResponseType
            >({
              action: ActionEvents.FILL_RIGHTMOVE_CONTACT_FORM,
              data: { selectedWarningItems, emailAgentUrl },
            });
          }
          return STEPS.REVIEW_MESSAGE;
        // No review message button - it's handled with user submission in rightmove itself & through the message actionevents.AGENT_CONTACT_FORM_SUBMITTED
        // No sign in step button - it's handled with user submission in rightmove itself & through the message actionevents.RIGHTMOVE_SIGN_IN
        case STEPS.EMAIL_SENT:
          const propertyListingUrl = propertyData.copyLinkUrl
            ? propertyData.copyLinkUrl.split("?")[0]
            : null;
          chrome.runtime.sendMessage({
            action: ActionEvents.NAVIGATE_BACK_TO_PROPERTY_LISTING,
            data: {
              url: propertyListingUrl,
            },
          });
          return STEPS.INITIAL_REVIEW;
        default:
          return STEPS.INITIAL_REVIEW;
      }
    });
  };

  const toggleSelection = (key: string) => {
    setSelectedWarningItems((prev) => {
      const isSelected = prev.some((item) => item.key === key);
      if (isSelected) return prev.filter((item) => item.key !== key);
      const selectedItem = askAgentItems.find((item) => item.key === key);
      return selectedItem ? [...prev, selectedItem] : prev;
    });
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

  // Track rendered groups to prevent duplicates
  const renderedGroupsSet = new Set<string>();

  const renderGroupHeading = (group: string) => {
    if (renderedGroupsSet.has(group)) return null;
    renderedGroupsSet.add(group);

    const itemCount = checklistToRender.filter(item => item.group === group).length;
    return (
      <li
        className="mt-5 font-bold text-base cursor-pointer flex justify-between items-center"
        onClick={() => toggleGroup(group)}
      >
        <span>{group} {!openChecklistGroups[group] && `(${itemCount})`}</span>
        <span className="mr-2">{openChecklistGroups[group] ? "▼" : "▲"}</span>
      </li>
    );
  };

  const handleBuildingNameOrNumberConfirmation = (buildingNameOrNumber: string) => {
    dispatch({
      type: PropertyReducerActionTypes.UPDATE_DISPLAY_ADDRESS,
      payload: { displayAddress: buildingNameOrNumber, isAddressConfirmedByUser: true },
    });
  }

  if (nonPropertyPageWarningMessage) {
    return (
      <Alert
        type="warning"
        message={nonPropertyPageWarningMessage}
      />
    );
  }

  if (isPropertyDataLoading) {
    return <SideBarLoading />;
  }

  const isPremiumDataFetched = premiumStreetDataQuery.isFetched

  return (
    <>
      {nonPropertyPageWarningMessage && (
        <Alert
          type="warning"
          message={nonPropertyPageWarningMessage}
        />
      )}
      {propertyData.isRental && (
        <Alert
          type="warning"
          message="Please note - Vesta Property Inspector currently only fully supports properties for sale and not rent. You can still use the tool but some features may not work as expected."
        />
      )}
      <div className={`p-4 ${!isAuthenticated ? 'pb-16' : 'pb-4'}`}>
        <SettingsBar
          openGroups={openChecklistGroups}
          setOpenGroups={setOpenChecklistGroups}
          propertyChecklistData={propertyChecklistData}
          filters={filters}
          toggleFilter={toggleFilter}
          currentStep={currentStep}
          handleNext={handleNextStep}
          agentDetails={propertyData.agent}
        />
        <ul style={{ listStyle: "none", padding: 0 }}>
          {checklistToRender.map((item) => {
            const showGroupHeading = item.group !== lastGroup;
            lastGroup = item.group;

            return (
              <React.Fragment key={item.key}>
                {showGroupHeading && renderGroupHeading(item.group)}
                {openChecklistGroups[item.group] && (
                  <ChecklistItem
                    item={item}
                    isSelected={
                      currentStep === STEPS.SELECT_ISSUES
                        ? selectedWarningItems.some((sel) => sel.key === item.key)
                        : true
                    }
                    onItemClick={
                      currentStep === STEPS.SELECT_ISSUES
                        ? () => toggleSelection(item.key)
                        : undefined
                    }
                    onValueClick={
                      getValueClickHandler(
                        item.key,
                        item.value,
                        openNewTab,
                        toggleCrimeChart,
                        togglePlanningPermissionCard,
                        toggleNearbyPlanningPermissionCard
                      )
                    }
                    isPremiumDataFetched={isPremiumDataFetched}
                  />
                )}
                {/* Dropdown crime piechart on crime score click */}
                {item.key === "crimeScore" && (
                  <div
                    ref={crimeContentRef}
                    style={{
                      maxHeight: crimeChartExpanded ? `${crimeContentHeight}px` : "0",
                      opacity: crimeChartExpanded ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                    }}
                  >
                    {crimeQuery.data && (
                      <Suspense fallback={<LoadingSpinner />}>
                        <LazyCrimePieChart
                          crimeSummary={crimeQuery.data.crimeSummary}
                          totalCrimes={crimeQuery.data.totalCrimes}
                          trendingPercentageOver6Months={
                            crimeQuery.data.trendingPercentageOver6Months
                          }
                        />
                      </Suspense>
                    )}
                  </div>
                )}
                {/* Dropdown planning permission card on planning permission property click */}
                {item.key === "planningPermissions" && (
                  <div
                    ref={planningPermissionContentRef}
                    style={{
                      maxHeight: planningPermissionCardExpanded ? `${planningPermissionContentHeight}px` : "0",
                      opacity: planningPermissionCardExpanded ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                    }}
                  >
                    {premiumStreetDataQuery.data && (
                      <Suspense fallback={<LoadingSpinner />}>
                        <LazyPlanningPermissionCard
                          planningPermissionData={premiumStreetDataQuery.data.data.attributes.planning_applications}
                          nearbyPlanningPermissionData={premiumStreetDataQuery.data.data.attributes.nearby_planning_applications}
                          isLoading={premiumStreetDataQuery.isLoading}
                          displayMode="property"
                        />
                      </Suspense>
                    )}
                  </div>
                )}
                {/* Dropdown planning permission card on nearby planning permission click */}
                {item.key === "nearbyPlanningPermissions" && (
                  <div
                    ref={nearbyPlanningPermissionContentRef}
                    style={{
                      maxHeight: nearbyPlanningPermissionCardExpanded ? `${nearbyPlanningPermissionContentHeight}px` : "0",
                      opacity: nearbyPlanningPermissionCardExpanded ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                    }}
                  >
                    {premiumStreetDataQuery.data && (
                      <Suspense fallback={<LoadingSpinner />}>
                        <LazyPlanningPermissionCard
                          nearbyPlanningPermissionData={premiumStreetDataQuery.data.data.attributes.nearby_planning_applications}
                          isLoading={premiumStreetDataQuery.isLoading}
                          displayMode="nearby"
                        />
                      </Suspense>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {!propertyData.address.isAddressConfirmedByUser &&
            checklistToRender.some(item => item.group === "Premium") && (
              <li className="mt-2 p-4">
                <Button
                  onClick={() => setShowBuildingValidationModal(true)}
                  className="w-full"
                >
                  Load Premium Data
                </Button>
              </li>
            )}
        </ul>
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

        {/* DevTools component - only visible in development mode */}
        <DevTools />
      </div>
    </>
  );
};

export default App;
