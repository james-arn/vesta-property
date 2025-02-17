import Alert from '@/components/ui/Alert';
import { ChecklistItem } from "@/components/ui/ChecklistItem";
import { CrimePieChart } from "@/components/ui/CrimePieChart";
import SideBarLoading from "@/components/ui/SideBarLoading/SideBarLoading";
import REACT_QUERY_KEYS from '@/constants/ReactQueryKeys';
import { STEPS } from "@/constants/steps";
import { useCrimeScore } from '@/hooks/useCrimeScore';
import { useFeedbackAutoPrompt } from '@/hooks/useFeedbackAutoPrompt';
import { FillRightmoveContactFormMessage } from "@/types/messages";
import { logErrorToSentry } from '@/utils/sentry';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from "react";
import { ActionEvents } from "../constants/actionEvents";
import {
  DataStatus,
  ExtractedPropertyScrapingData,
  PropertyDataList,
} from "../types/property";
import {
  extractPropertyIdFromUrl,
  filterChecklistToAllAskAgentOnlyItems
} from "./helpers";
import { generatePropertyChecklist } from "./propertychecklist/propertyChecklist";
import SettingsBar from "./settingsbar/SettingsBar";


const emptyPropertyData: ExtractedPropertyScrapingData = {
  salePrice: null,
  location: null,
  bedrooms: null,
  bathrooms: null,
  councilTax: null,
  size: null,
  propertyType: null,
  propertyId: null,
  tenure: null,
  parking: null,
  heating: null,
  floorPlan: null,
  garden: null,
  epc: null,
  broadband: null,
  listingHistory: null,
  windows: null,
  publicRightOfWayObligation: null,
  privateRightOfWayObligation: null,
  listedProperty: {
    value: null,
    status: null,
    reason: null,
  },
  restrictions: null,
  floodDefences: null,
  floodSources: null,
  floodedInLastFiveYears: null,
  accessibility: null,
  agent: null,
  copyLinkUrl: null,
  isRental: false,
  salesHistory: {
    priceDiscrepancy: {
      value: null,
      status: null,
      reason: null,
    },
    compoundAnnualGrowthRate: null,
    volatility: null,
  },
  buildingSafety: {
    value: null,
    status: null,
    reason: null,
  },
  coastalErosion: {
    value: null,
    status: null,
    reason: null,
  },
  miningImpact: {
    value: null,
    status: null,
    reason: null,
  },
  locationCoordinates: {
    lat: null,
    lng: null,
  },
};

const App: React.FC = () => {
  const [propertyData, setPropertyData] =
    useState<ExtractedPropertyScrapingData>(emptyPropertyData);
  const [nonPropertyPageWarningMessage, setNoPropertyPageWarningMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    showAskAgentOnly: false,
    // Add more filters here
  });
  const [currentStep, setCurrentStep] = useState<keyof typeof STEPS>(
    STEPS.INITIAL_REVIEW
  );
  const [selectedWarningItems, setSelectedWarningItems] = useState<
    PropertyDataList[]
  >([]);
  const [isPropertyDataLoading, setIsPropertyDataLoading] = useState<boolean>(true);
  const crimeQuery = useCrimeScore(
    propertyData.locationCoordinates.lat?.toString() || "",
    propertyData.locationCoordinates.lng?.toString() || ""
  );

  const [crimeChartExpanded, setCrimeChartExpanded] = useState(false);
  const crimeContentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useFeedbackAutoPrompt(propertyData.propertyId, currentStep);
  const queryClient = useQueryClient();


  useEffect(() => {
    // **1. Add Message Listener First**
    const handleMessage = (message: { action: string; data?: any }) => {
      console.log("[Side Panel] Received message:", message);
      if (message.action === ActionEvents.TAB_CHANGED_OR_EXTENSION_OPENED) {
        const propertyIdFromTabUrl = extractPropertyIdFromUrl(message.data);
        const cachedPropertyData = queryClient.getQueryData<ExtractedPropertyScrapingData>([REACT_QUERY_KEYS.PROPERTY_DATA, propertyIdFromTabUrl]);
        if (cachedPropertyData) {
          setPropertyData(cachedPropertyData);
          setIsPropertyDataLoading(false);
        } else {
          setPropertyData(emptyPropertyData);
          setIsPropertyDataLoading(true);
        }
      }

      if (message.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        // Cache the data when it's updated so it can be reused later
        queryClient.setQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, message.data.propertyId], message.data);
        setPropertyData(message.data);
        setIsPropertyDataLoading(false);
        setNoPropertyPageWarningMessage(null);
        console.log("[Side Panel] Property data updated:", message.data);
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        setNoPropertyPageWarningMessage(message.data || null);
        setIsPropertyDataLoading(false);
        setPropertyData(emptyPropertyData);
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
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // **2. Send 'SIDE_PANEL_OPENED' Message After Listener is Set Up**
    console.log(
      "[Side Panel] Component mounted. Sending SIDE_PANEL_OPENED message."
    );
    chrome.runtime.sendMessage(
      { action: ActionEvents.SIDE_PANEL_OPENED },
      (response) => {
        if (chrome.runtime.lastError) {
          logErrorToSentry(
            chrome.runtime.lastError
          );
        } else {
          console.log("[Side Panel] Background response:", response);
        }
      }
    );

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [queryClient]);

  useEffect(() => {
    if (crimeContentRef.current) {
      setContentHeight(crimeContentRef.current.scrollHeight);
    }
  }, [crimeChartExpanded, crimeQuery.data]);

  const propertyChecklistData = generatePropertyChecklist(propertyData, crimeQuery);

  const initialOpenGroups = propertyChecklistData.reduce(
    (acc, item) => {
      acc[item.group] = true;
      return acc;
    },
    {} as { [key: string]: boolean }
  );
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>(
    initialOpenGroups
  );

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  let lastGroup = "";

  const handleEpcClick = (url: string) => {
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


  const renderGroupHeading = (group: string) => {
    const itemCount = checklistToRender.filter(item => item.group === group).length;
    return (
      <li
        className="mt-5 font-bold text-lg cursor-pointer flex justify-between items-center"
        onClick={() => toggleGroup(group)}
      >
        <span>{group} {!openGroups[group] && `(${itemCount})`}</span>
        <span>{openGroups[group] ? "▼" : "▲"}</span>
      </li>
    );
  };


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

  return (
    <>
      {nonPropertyPageWarningMessage && (
        <Alert
          type="warning"
          message={nonPropertyPageWarningMessage}
          onClose={() => setNoPropertyPageWarningMessage(null)}
        />
      )}
      {propertyData.isRental && (
        <Alert
          type="warning"
          message="Please note - Vesta Property Inspector currently only fully supports properties for sale and not rent. You can still use the tool but some features may not work as expected."
          onClose={() => setNoPropertyPageWarningMessage(null)}
        />
      )}
      <div className="p-4">
        <SettingsBar
          openGroups={openGroups}
          setOpenGroups={setOpenGroups}
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
                    item.key === "epc" || item.key === "floorPlan"
                      ? () => handleEpcClick(String(item.value))
                      : item.key === "crimeScore"
                        ? toggleCrimeChart
                        : undefined
                  }
                />
                {/* Dropdown crime piechart on crime score click */}
                {item.key === "crimeScore" && (
                  <div
                    ref={crimeContentRef}
                    style={{
                      maxHeight: crimeChartExpanded ? `${contentHeight}px` : "0",
                      opacity: crimeChartExpanded ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                    }}
                  >
                    {crimeQuery.data && (
                      <CrimePieChart
                        crimeSummary={crimeQuery.data.crimeSummary}
                        totalCrimes={crimeQuery.data.totalCrimes}
                        trendingPercentageOver6Months={
                          crimeQuery.data.trendingPercentageOver6Months
                        }
                      />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default App;
