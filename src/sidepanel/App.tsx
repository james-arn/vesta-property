import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STEPS } from "@/constants/steps";
import { FillRightmoveContactFormMessage } from "@/types/messages";
import React, { useEffect, useState } from "react";
import { FaInfoCircle } from 'react-icons/fa';
import { ActionEvents } from "../constants/actionEvents";
import {
  DataStatus,
  ExtractedPropertyData,
  PropertyDataList,
} from "../types/property";
import {
  filterChecklistToAllAskAgentOnlyItems,
  getStatusIcon
} from "./helpers";
import { generatePropertyChecklist } from "./propertychecklist/propertyChecklist";
import SettingsBar from "./settingsbar/SettingsBar";

const emptyPropertyData: ExtractedPropertyData = {
  salePrice: null,
  location: null,
  bedrooms: null,
  bathrooms: null,
  councilTax: null,
  size: null,
  propertyType: null,
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
  listedProperty: null,
  restrictions: null,
  floodDefences: null,
  floodSources: null,
  floodedInLastFiveYears: null,
  accessibility: null,
  agent: null,
  copyLinkUrl: null,
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
};

const App: React.FC = () => {
  const [propertyData, setPropertyData] =
    useState<ExtractedPropertyData>(emptyPropertyData);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
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

  useEffect(() => {
    // **1. Add Message Listener First**
    const handleMessage = (message: { action: string; data?: any }) => {
      console.log("[Side Panel] Received message:", message);
      if (message.action === ActionEvents.UPDATE_PROPERTY_DATA) {
        setPropertyData(message.data);
        setWarningMessage(null);
        console.log("[Side Panel] Property data updated:", message.data);
      } else if (message.action === ActionEvents.SHOW_WARNING) {
        setWarningMessage(message.data || null);
        setPropertyData(emptyPropertyData);
        console.log("[Side Panel] Warning message set:", message.data);
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
          console.error(
            "[Side Panel] Error sending SIDE_PANEL_OPENED message:",
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
  }, []);

  const propertyChecklistData = generatePropertyChecklist(propertyData);

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
        // no review message button - it's handled with user submission in rightmove itself 
        // & through the message actionevents.AGENT_CONTACT_FORM_SUBMITTED
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

  const renderChecklistItem = (item: PropertyDataList) => {
    const isSelected = selectedWarningItems.some(
      (selectedItem) => selectedItem.key === item.key
    );
    const isWarning = item.status === DataStatus.ASK_AGENT;
    return (
      <li
        key={item.key}
        className={`grid grid-cols-[1rem_90px_1fr_2rem] items-center p-2 bg-gray-100 rounded-md my-1 ${currentStep === STEPS.SELECT_ISSUES && !isSelected ? 'opacity-30' : ''} ${isWarning ? 'border border-yellow-400' : ''}`}
        onClick={() => currentStep === STEPS.SELECT_ISSUES && toggleSelection(item.key)}
      >
        <div className="flex items-center justify-start">
          {getStatusIcon(item.status)}
        </div>
        <div className="flex items-center ml-2">
          <span>{item.label}</span>
        </div>
        <div className="text-gray-800 ml-4">
          {(item.key === "epc" || item.key === "floorPlan") && item.value !== "Not mentioned" ? (
            <span onClick={() => handleEpcClick(item.value ?? "")} className="cursor-pointer text-blue-500 underline">
              Yes
            </span>
          ) : (
            <span>{item.value || "Not found"}</span>
          )}
        </div>
        <div className="flex items-center justify-center ml-4">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <FaInfoCircle className="cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="w-[200px] whitespace-pre-line">
                {item.toolTipExplainer}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </li>
    );
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

  if (warningMessage) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-md">
        {warningMessage}
      </div>
    );
  }

  return (
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
              <div
                style={{
                  maxHeight: openGroups[item.group] ? "1000px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.3s ease, opacity 0.3s ease",
                  opacity: openGroups[item.group] ? 1 : 0,
                }}
              >
                {renderChecklistItem(item)}
              </div>
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
};

export default App;
