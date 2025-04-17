import FloodRiskDisplay from "@/components/ui/Premium/FloodRiskDisplay";
import { getNearbyPlanningApplicationsStatus, getNearbyPlanningApplicationsValue, getPropertyPlanningApplicationsStatus, getPropertyPlanningApplicationsValue } from "@/components/ui/Premium/PlanningPermission/helpers";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { PropertyGroups } from "@/constants/propertyConsts";
import { LOW_TURNOVER_THRESHOLD } from "@/constants/scoreConstants";
import { volatilityThreshold } from "@/constants/thresholds";
import { CrimeScoreData, getCrimeScoreStatus, getCrimeScoreValue } from "@/hooks/useCrimeScore";
import { EpcBandResult } from "@/types/epc";
import { formatCurrencyGBP, formatPercentage } from "@/utils/formatting";
import { getStatusFromString } from "@/utils/statusHelpers";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import { UseQueryResult } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import React from "react";
import {
  ConfidenceLevels,
  DataStatus,
  ExtractedPropertyScrapingData,
  PreprocessedData,
  PropertyDataListItem,
} from "../../types/property";
import {
  getCAGRStatus,
  getStatusFromBoolean,
  getVolatilityStatus,
  getYesNoOrAskAgentStringFromBoolean,
  getYesNoOrMissingStatus,
  priceDiscrepancyMessages
} from "./helpers";

export function generatePropertyChecklist(
  propertyData: ExtractedPropertyScrapingData,
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined,
  preprocessedData: PreprocessedData
): PropertyDataListItem[] {
  if (!propertyData) {
    console.error('No property data provided to generatePropertyChecklist');
    return [];
  }

  const {
    isPreprocessedDataLoading,
    preprocessedDataError,
    processedPremiumData,
    processedEpcResult,
    finalEpcValue,
    finalEpcConfidence,
    finalEpcSource,
    calculatedLeaseMonths,
    broadbandDisplayValue,
    broadbandStatus,
    listingHistoryStatus,
    listingHistoryDisplayValue,
  } = preprocessedData;

  const hasPremiumDataLoadedSuccessfully = processedPremiumData?.status === "success"

  const getStatusFromPremium = (
    value: unknown | null | undefined
  ): DataStatus => {
    if (isPreprocessedDataLoading) return DataStatus.IS_LOADING;
    if (preprocessedDataError || processedPremiumData?.status === "error") return DataStatus.ASK_AGENT;
    if (hasPremiumDataLoadedSuccessfully) {
      const isValid = value !== null && value !== undefined;
      return isValid ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT;
    }
    return DataStatus.ASK_AGENT;
  };

  const crimeScoreData = crimeScoreQuery?.data;
  const isCrimeScoreLoading = crimeScoreQuery?.isLoading ?? false;
  const crimeScoreError = crimeScoreQuery?.error instanceof Error ? crimeScoreQuery.error : null;

  const baseEpcItem = {
    label: "EPC Rating",
    key: "epc",
    checklistGroup: PropertyGroups.UTILITIES,
    dashboardGroup: DashboardScoreCategory.RUNNING_COSTS,
    isUnlockedWithPremium: false,
    isBoostedWithPremium: true,
    epcBandData:
      processedEpcResult?.scores && 'currentBand' in processedEpcResult.scores
        ? processedEpcResult.scores as EpcBandResult
        : undefined,
  };
  let epcChecklistItem: PropertyDataListItem;
  if (isPreprocessedDataLoading) {
    epcChecklistItem = {
      ...baseEpcItem,
      value: "Loading...",
      status: DataStatus.IS_LOADING,
      askAgentMessage: "Processing EPC/Premium Data...",
      toolTipExplainer: "Attempting to determine EPC rating and other data.",
      confidence: ConfidenceLevels.NONE,
    };
  } else if (preprocessedDataError) {
    const errorMsg = preprocessedDataError.message || "Processing failed";
    epcChecklistItem = {
      ...baseEpcItem,
      value: `Error: ${errorMsg}`,
      status: DataStatus.ASK_AGENT,
      askAgentMessage: `Error processing data (${errorMsg}). Ask Agent?`,
      toolTipExplainer: `Data processing failed: ${errorMsg}`,
      confidence: ConfidenceLevels.NONE,
    };
  } else {
    epcChecklistItem = {
      ...baseEpcItem,
      value: finalEpcValue ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      status: finalEpcValue ? DataStatus.FOUND_POSITIVE : DataStatus.ASK_AGENT,
      confidence: finalEpcConfidence,
      askAgentMessage: finalEpcValue ? "" : "Could not determine EPC. Ask Agent?",
      toolTipExplainer: finalEpcValue
        ? `EPC Rating determined as ${finalEpcValue}. Confidence: ${finalEpcConfidence}, Source: ${finalEpcSource}`
        : "Could not determine the EPC rating from available data.",
    };
  }

  // --- Generate Lease Term Checklist Item --- (Directly)
  const baseLeaseItem = {
    label: "Remaining Lease Term",
    key: "leaseTerm",
    checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
    isUnlockedWithPremium: false,
    isBoostedWithPremium: true,
  };
  let leaseTermChecklistItem: PropertyDataListItem;
  if (propertyData.tenure?.toLowerCase() !== "leasehold") {
    leaseTermChecklistItem = {
      ...baseLeaseItem,
      status: DataStatus.NOT_APPLICABLE,
      value: CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "",
      toolTipExplainer: "Lease term is only applicable to leasehold properties.",
    };
  } else if (isPreprocessedDataLoading) {
    leaseTermChecklistItem = {
      ...baseLeaseItem,
      value: "Loading Premium Data...",
      status: DataStatus.IS_LOADING,
      askAgentMessage: "",
      toolTipExplainer: "Fetching detailed lease information.",
    };
  } else if (preprocessedDataError || processedPremiumData?.status === "error") {
    const errorMsg = preprocessedDataError?.message || "Premium data fetch failed";
    leaseTermChecklistItem = {
      ...baseLeaseItem,
      value: `Error: ${errorMsg}`,
      status: DataStatus.ASK_AGENT,
      askAgentMessage: `Could not retrieve lease details (${errorMsg}). Ask Agent?`,
      toolTipExplainer: `Failed to fetch premium lease data: ${errorMsg}`,
    };
  } else {
    const formattedTerm = processedPremiumData?.formattedPremiumLeaseTerm;
    const leaseMonths = calculatedLeaseMonths;
    const value = formattedTerm || propertyData.leaseTerm || CHECKLIST_NO_VALUE.NOT_MENTIONED;
    const status = formattedTerm
      ? DataStatus.FOUND_POSITIVE
      : getStatusFromString(propertyData.leaseTerm);
    leaseTermChecklistItem = {
      ...baseLeaseItem,
      status,
      value,
      askAgentMessage:
        status === DataStatus.ASK_AGENT ? "What is the remaining lease term?" : "",
      toolTipExplainer:
        `The remaining duration of the leasehold agreement. Premium data indicates: ${formattedTerm ?? "Not Available"}. Scraped value: ${propertyData.leaseTerm ?? "N/A"}. Remaining months: ${leaseMonths ?? "N/A"}`,
    };
  }

  const askingVsEstimatePriceComparisonItem: PropertyDataListItem | null = (() => {
    const askingVsEstimatePercentage = processedPremiumData?.askingVsEstimatePercentage;
    const askingVsEstimateAbsolute = processedPremiumData?.askingVsEstimateAbsolute;

    if (
      askingVsEstimatePercentage !== null &&
      askingVsEstimatePercentage !== undefined &&
      askingVsEstimateAbsolute !== null &&
      askingVsEstimateAbsolute !== undefined
    ) {
      const isUndervalued = askingVsEstimateAbsolute > 0;
      const formattedPercentage = askingVsEstimatePercentage.toFixed(1);
      const formattedAbsolute = formatCurrencyGBP(Math.abs(askingVsEstimateAbsolute));
      const valueString = `${formattedPercentage}% (${formattedAbsolute}) ${isUndervalued ? "undervalued" : "overvalued"}`;

      return {
        key: "askingVsEstimateComparison",
        label: "Asking Price vs Estimate",
        value: valueString,
        status: DataStatus.FOUND_POSITIVE,
        checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
        askAgentMessage: "", // For reference only.
        toolTipExplainer: `Compares the asking price to the estimated market value. ${isUndervalued ? "Undervalued properties may represent better immediate value." : "Overvalued properties might indicate a seller's high expectation or unique features not captured by the estimate."}`,
        isUnlockedWithPremium: true,
        isBoostedWithPremium: false,
      };
    } else {
      // Premium data unavailable: Show placeholder
      return {
        key: "askingVsEstimateComparison",
        label: "Asking Price vs Estimate",
        value: CHECKLIST_NO_VALUE.NOT_AVAILABLE, // Use existing constant
        status: DataStatus.ASK_AGENT, // Indicate action needed (unlock premium)
        checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
        askAgentMessage: "", // No direct agent question here
        toolTipExplainer: "Compares the asking price to the estimated market value. Comparison requires Estimated Sale Value (Premium Data Feature).",
        isUnlockedWithPremium: true,
        isBoostedWithPremium: false,
      };
    }
  })();

  const checklist: (PropertyDataListItem | null)[] = [
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Price",
      key: "price",
      status: getStatusFromString(propertyData.salePrice),
      value: propertyData.salePrice,
      askAgentMessage: "What's the price?",
      toolTipExplainer:
        "Knowing the purchase price means you can work out the total cost of buying the property.\n\n" +
        "Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Tenure",
      key: "tenure",
      status: getStatusFromString(propertyData.tenure),
      value: capitaliseFirstLetterAndCleanString(propertyData.tenure ?? ""),
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations.\n\n" +
        "Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure.\n\n" +
        "Each tenure type has different responsibilities, rights, and costs associated with it.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Location",
      key: "location",
      status: getStatusFromString(propertyData.address.displayAddress),
      value: propertyData.address.displayAddress,
      askAgentMessage: "Where's the property located?",
      toolTipExplainer:
        "Location is a critical factor in property valuation and desirability.\n\n" +
        "It affects accessibility to amenities, schools, and transport links, and can influence the property's future value.\n\n" +
        "A prime location can enhance lifestyle and convenience, while also impacting safety and community engagement.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Property Type",
      key: "propertyType",
      status: getStatusFromString(propertyData.propertyType),
      value: propertyData.propertyType,
      askAgentMessage: "What's the property type?",
      toolTipExplainer:
        "Property type refers to the category of the property, such as residential, commercial, or mixed-use.\n\n" +
        "It can also include specific types like flats, houses, or apartments.\n\n" +
        "Understanding the property type helps in assessing its value, potential use, and market demand.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Accessibility",
      key: "accessibility",
      status: getStatusFromString(propertyData.accessibility),
      value: propertyData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs.\n\n" +
        "Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Listing history",
      key: "listingHistory",
      status: listingHistoryStatus ?? DataStatus.ASK_AGENT,
      value: listingHistoryDisplayValue ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: listingHistoryStatus === DataStatus.ASK_AGENT ? "What's the listing history?" : "",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market.\n\n" +
        "This can indicate whether the property has been difficult to sell or if it has had price reductions.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Occupancy Status",
      key: "occupancyStatus",
      status: getStatusFromPremium(processedPremiumData?.occupancyStatus),
      value: processedPremiumData?.occupancyStatus ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "Indicates if the property is currently owner-occupied or rented out.\n\n" +
        "This can affect availability for viewing and moving in, and potentially indicate property condition based on tenure history.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },

    // Investment Potential
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Price Change from last sale",
      key: "priceDiscrepancy",
      status:
        propertyData.salesHistory.priceDiscrepancy.status ?? DataStatus.ASK_AGENT,
      value: propertyData.salesHistory.priceDiscrepancy.value,
      askAgentMessage:
        priceDiscrepancyMessages[
          propertyData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.askAgentMessage || "",
      toolTipExplainer:
        priceDiscrepancyMessages[
          propertyData.salesHistory.priceDiscrepancy.reason ?? ""
        ]?.toolTipExplainer ||
        "This metric shows the percentage change between the current listing price and the last sold price, " +
        "adjusted for the time span between these transactions. It helps determine whether the price is aligned with historical market trends.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    askingVsEstimatePriceComparisonItem,
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Historical Compound Annual Growth Rate (CAGR)",
      key: "compoundAnnualGrowthRate",
      status: getCAGRStatus(propertyData.salesHistory.compoundAnnualGrowthRate),
      value:
        propertyData.salesHistory.compoundAnnualGrowthRate !== null &&
          typeof propertyData.salesHistory.compoundAnnualGrowthRate === "number"
          ? `${(propertyData.salesHistory.compoundAnnualGrowthRate * 100).toFixed(2)}%`
          : "N/A",
      askAgentMessage: (() => {
        const cagr = propertyData.salesHistory.compoundAnnualGrowthRate;
        if (cagr === null || typeof cagr !== "number") return "";
        if (cagr < 0.03) return "The historical growth rate appears low compared to market expectations. Is there reasons as to why the property underperformed historically?";
        return "";
      })(),
      toolTipExplainer:
        "The CAGR represents the average yearly increase in the property's historical sale values (excluding the current listing). \n\n" +
        "A CAGR below 3% indicates that the property has underperformed historically." +
        (propertyData.salesHistory.compoundAnnualGrowthRate === null
          ? "\n\nIt is N/A as there is no sales history."
          : ""),
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Volatility",
      key: "volatility",
      status: getVolatilityStatus(
        propertyData.salesHistory.volatility,
        volatilityThreshold
      ),
      value: propertyData.salesHistory.volatility,
      askAgentMessage: (() => {
        const volStr = propertyData.salesHistory.volatility;
        if (!volStr || volStr === "N/A") return "";
        const volatilityNumber = parseFloat(volStr.replace("%", ""));
        if (!isNaN(volatilityNumber) && volatilityNumber > volatilityThreshold) return "The price history for this property shows significant fluctuations. Is there a reason for these variations?";
        return "";
      })(),
      toolTipExplainer:
        "Volatility measures the degree of fluctuation in the property's sale price changes over time by calculating the standard deviation of the percentage changes between consecutive sales.\n\n" +
        "A value below 10% generally indicates stable, consistent price changes, while a value above 10% suggests greater variability. \n\n" +
        "This 10% threshold is set as a benchmark for normal fluctuations in a stable market. \n\n" +
        "Keep in mind that with only a few data points available, this metric might not be fully representative and could display as 'N/A'.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Sale Value",
      key: "estimatedSaleValue",
      status: getStatusFromPremium(processedPremiumData?.estimatedSaleValue),
      value: formatCurrencyGBP(processedPremiumData?.estimatedSaleValue),
      askAgentMessage: "",
      toolTipExplainer:
        "An automated valuation model (AVM) estimate of the property's current market value.\n\n" +
        "Useful as a benchmark against the asking price, but accuracy can vary based on data availability and property uniqueness.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Rental Value",
      key: "estimatedRentalValue",
      status: getStatusFromPremium(processedPremiumData?.estimatedRentalValue),
      value: formatCurrencyGBP(processedPremiumData?.estimatedRentalValue),
      askAgentMessage: "",
      toolTipExplainer:
        "An estimate of the potential monthly rent the property could achieve in the current market.\n\n" +
        "Important for buy-to-let investors to assess potential income and returns.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Annual Rental Yield",
      key: "estimatedAnnualRentalYield",
      status: getStatusFromPremium(processedPremiumData?.estimatedAnnualRentalYield),
      value: formatPercentage(processedPremiumData?.estimatedAnnualRentalYield),
      askAgentMessage: "",
      toolTipExplainer:
        "Calculates the potential annual rental income as a percentage of the property's estimated value.\n\n" +
        "A key metric for investors comparing the profitability of different property investments.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Sell",
      key: "propensityToSell",
      status: getStatusFromPremium(processedPremiumData?.propensityToSell),
      value:
        processedPremiumData && processedPremiumData.propensityToSell !== null
          ? formatPercentage(processedPremiumData.propensityToSell)
          : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of how likely similar properties in the area are to be listed for sale.\n\n" +
        "Can reflect market liquidity and potential competition or availability.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Let",
      key: "propensityToLet",
      status: getStatusFromPremium(processedPremiumData?.propensityToLet),
      value:
        processedPremiumData && processedPremiumData.propensityToLet !== null
          ? formatPercentage(processedPremiumData.propensityToLet)
          : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of the likelihood that similar properties in the area are listed for rent.\n\n" +
        "Reflects the strength of the local rental market and potential for buy-to-let investment.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Market Activity (Turnover Rate)",
      key: "marketTurnoverRate",
      status: (() => {
        const turnoverRate = processedPremiumData?.outcodeTurnoverRate;
        const baseStatus = getStatusFromPremium(turnoverRate);
        if (baseStatus === DataStatus.FOUND_POSITIVE && turnoverRate !== null && turnoverRate !== undefined) {
          return turnoverRate < LOW_TURNOVER_THRESHOLD
            ? DataStatus.ASK_AGENT
            : DataStatus.FOUND_POSITIVE;
        }
        return baseStatus;
      })(),
      value: (() => {
        const sales = processedPremiumData?.outcodeMarketActivity;
        const total = processedPremiumData?.outcodeTotalProperties;
        const outcode = processedPremiumData?.outcodeIdentifier || "area";
        const rate = processedPremiumData?.outcodeTurnoverRate;
        if (rate !== null && rate !== undefined && sales !== null && total !== null) {
          return (
            <>
              Sales (12m): {sales}<br />
              Properties: {total}<br />
              Turnover Rate: {(rate * 100).toFixed(1)}%<br />
              Area: {outcode}
            </>
          );
        } else if (sales !== null) {
          return (
            <>
              Sales (12m): {sales}<br />
              Properties: Unknown<br />
              Area: {outcode}
            </>
          )
        } else if (total !== null) {
          return (
            <>
              Sales (12m): Unknown<br />
              Properties: {total}<br />
              Area: {outcode}
            </>
          )
        }
        return CHECKLIST_NO_VALUE.NOT_AVAILABLE;
      })(),
      askAgentMessage: "Market turnover seems low (<3%). Is there a reason for this?",
      toolTipExplainer:
        "Compares the number of sales in the last 12 months to the total number of properties in the postcode area (e.g., M5).\n\n" +
        "A higher percentage (turnover rate) indicates a more liquid/active market. Typical UK average is around 4-5%.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Outcode Average Sales Price",
      key: "outcodeAvgSalesPrice",
      status: getStatusFromPremium(processedPremiumData?.outcodeAvgSalesPrice),
      value: formatCurrencyGBP(processedPremiumData?.outcodeAvgSalesPrice),
      askAgentMessage: "",
      toolTipExplainer:
        "The average price properties sold for within the outcode over a recent period.\n\n" +
        "Provides a general benchmark for property values in the area.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    // Utilities
    epcChecklistItem, // Include generated EPC item
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Heating",
      key: "heatingType",
      status: getStatusFromString(propertyData.heating),
      value: processedPremiumData?.constructionMaterials?.heating ?? propertyData.heating,
      askAgentMessage: "What type of heating system?",
      toolTipExplainer: "The type of heating system used in the property, such as gas central heating, electric heating, or oil-fired heating.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Broadband Speed",
      key: "broadband",
      status: broadbandStatus ?? DataStatus.ASK_AGENT,
      value: broadbandDisplayValue ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "What is the broadband speed?",
      toolTipExplainer: "Broadband speed impacts internet usage for work, streaming, and gaming.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Mobile Coverage",
      key: "mobileCoverage",
      status: getStatusFromPremium(processedPremiumData?.mobileServiceCoverage),
      value: processedPremiumData?.mobileServiceCoverage ? "Details Available" : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer: "Information on the signal strength and availability of major mobile network providers at the property.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Council Tax Band",
      key: "councilTax",
      status: getStatusFromString(propertyData.councilTax, ["tbc"]),
      value: propertyData.councilTax,
      askAgentMessage: "What council tax band?",
      toolTipExplainer:
        "Council tax is a payment to the local authority for services like schools and waste collection.\n\n" +
        "Council tax bands are based on property value, and some exemptions apply (e.g., students).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },

    // Interior (Restore full tooltips)
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bedrooms",
      key: "bedrooms",
      status: getStatusFromString(propertyData.bedrooms),
      value: propertyData.bedrooms,
      askAgentMessage: "How many bedrooms?",
      toolTipExplainer: "The number of bedrooms in the property, a key factor in determining its size and value.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bathrooms",
      key: "bathrooms",
      status: getStatusFromString(propertyData.bathrooms),
      value: propertyData.bathrooms,
      askAgentMessage: "How many bathrooms?",
      toolTipExplainer: "The number of bathrooms in the property, impacting convenience and overall value.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Size",
      key: "size",
      status: getStatusFromString(propertyData.size),
      value: propertyData.size,
      askAgentMessage: "What's the size?",
      toolTipExplainer:
        "The size of a property refers to the total area of the property, including all habitable rooms and spaces.\n\n" +
        "It is a key factor in determining the property's value, as larger properties generally have higher value.\n\n" +
        "Size can also impact the property's energy efficiency and maintenance costs.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Floor Plan",
      key: "floorPlan",
      status: getStatusFromString(propertyData.floorPlan),
      value: DOMPurify.sanitize(propertyData.floorPlan ?? ""),
      askAgentMessage: "Do you have a floor plan?",
      toolTipExplainer:
        "A floor plan is a detailed layout of the property's interior spaces, including rooms, hallways, and other features.\n\n" +
        "It provides a visual representation of the property's layout and can be useful for understanding the property's size, layout, and potential for renovation or extension.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Materials",
      key: "constructionMaterials",
      status: getStatusFromPremium(processedPremiumData?.constructionMaterials),
      value: `Floor: ${processedPremiumData?.constructionMaterials?.floor ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}, Walls: ${processedPremiumData?.constructionMaterials?.walls ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}, Roof: ${processedPremiumData?.constructionMaterials?.roof ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}, Windows: ${processedPremiumData?.constructionMaterials?.windows ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE}`,
      askAgentMessage: "",
      toolTipExplainer:
        "The primary materials used to build the property (e.g., brick, timber frame, concrete).\n\n" +
        "Affects insulation, maintenance requirements, longevity, and potentially mortgageability or insurance.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Age Band",
      key: "constructionAgeBand",
      status: getStatusFromPremium(processedPremiumData?.constructionAgeBand),
      value: processedPremiumData?.constructionAgeBand ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "The approximate period when the property was built (e.g., pre-1900, 1950s, 2000s).\n\n" +
        "Influences architectural style, potential need for renovations, energy efficiency, and presence of period features.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },

    // Exterior (Restore full tooltips)
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: "parking",
      status: getStatusFromString(propertyData.parking),
      value: propertyData.parking,
      askAgentMessage: "What parking is available?",
      toolTipExplainer: "Details about parking availability, such as driveway, garage, or on-street parking permits.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Garden",
      key: "garden",
      status: getYesNoOrMissingStatus(propertyData.garden),
      value: propertyData.garden ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Is there a garden?",
      toolTipExplainer:
        "A garden is a private outdoor space associated with a property, providing a place for relaxation, entertainment, and gardening.\n\n" +
        "It can range from a small patio or balcony to a large garden with various features like lawns, trees, and outdoor living areas.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Windows",
      key: "windows",
      status: (() => {
        const premiumWindows = processedPremiumData?.constructionMaterials?.windows;
        const premiumStatus = getStatusFromPremium(premiumWindows);
        if (premiumStatus === DataStatus.FOUND_POSITIVE) return DataStatus.FOUND_POSITIVE;
        if (premiumStatus === DataStatus.IS_LOADING) return DataStatus.IS_LOADING;
        return getStatusFromString(propertyData.windows);
      })(),
      value: (() => {
        const premiumWindows = processedPremiumData?.constructionMaterials?.windows;
        if (processedPremiumData?.status === "success" && premiumWindows) {
          return premiumWindows;
        }
        return propertyData.windows ?? CHECKLIST_NO_VALUE.NOT_MENTIONED;
      })(),
      askAgentMessage: "Windows - material & glazing?",
      toolTipExplainer: "Information about the windows, such as material (uPVC, wood) and glazing type (single, double, triple).",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },

    // Rights & Restrictions (Restore full tooltips)
    leaseTermChecklistItem, // Tooltip handled internally
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictions",
      key: "restrictions",
      status: getStatusFromBoolean(propertyData.restrictions, true),
      value: getYesNoOrAskAgentStringFromBoolean(propertyData.restrictions),
      askAgentMessage: "Any restrictions?",
      toolTipExplainer: "Information about any known restrictions or covenants affecting the property, such as limitations on alterations or use.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Listed Property",
      key: "listedProperty",
      status: propertyData.listedProperty.status ?? DataStatus.ASK_AGENT,
      value: propertyData.listedProperty.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.listedProperty.reason ?? "",
      toolTipExplainer: "Indicates if the property is listed (Grade I, II*, II), which imposes restrictions on alterations.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictive Covenants",
      key: "restrictiveCovenants",
      status: getStatusFromPremium(processedPremiumData?.restrictiveCovenants),
      value: processedPremiumData?.restrictiveCovenants ? "Details Available" : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer: "Legal obligations tied to the property deed that restrict its use or modification (e.g., no business use, limits on extensions).",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Public Right of Way",
      key: "publicRightOfWay",
      status: getStatusFromPremium(
        processedPremiumData?.publicRightOfWay?.has_public_right_of_way === true ? true :
          processedPremiumData?.publicRightOfWay?.has_public_right_of_way === false ? false :
            null
      ),
      value: getYesNoOrAskAgentStringFromBoolean(
        processedPremiumData?.publicRightOfWay?.has_public_right_of_way === true ? true :
          processedPremiumData?.publicRightOfWay?.has_public_right_of_way === false ? false :
            null
      ),
      askAgentMessage: "",
      toolTipExplainer: "Indicates if a public footpath or bridleway crosses the property land.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Conservation Area Status",
      key: "conservationAreaStatus",
      status: processedPremiumData?.conservationAreaDetails.conservationAreaDataAvailable
        ? getStatusFromPremium(processedPremiumData?.conservationAreaDetails.conservationArea)
        : DataStatus.ASK_AGENT,
      value: processedPremiumData?.conservationAreaDetails.conservationArea ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer: "Indicates if the property is within a conservation area, which adds controls over demolition, alterations, and tree work.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Property Planning Permissions",
      key: "planningPermissions",
      status: getPropertyPlanningApplicationsStatus(
        processedPremiumData?.propertyPlanningApplications
      ),
      value: getPropertyPlanningApplicationsValue(
        processedPremiumData?.propertyPlanningApplications
      ),
      askAgentMessage: "I noticed there are quite a few planning permissions on the property. Do you have more information on this?",
      toolTipExplainer:
        "Planning permission is a key aspect of property regulation in the UK.\n\n" +
        "It typically applies to the specific property and its immediate surroundings, ensuring that any proposed alterations or developments align with local council guidelines.\n\n" +
        "Reviewing the planning permission history can reveal existing restrictions or opportunities for future renovations, which is crucial information when buying a property. ",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Nearby Planning Permissions",
      key: "nearbyPlanningPermissions",
      status: getNearbyPlanningApplicationsStatus(
        processedPremiumData?.nearbyPlanningApplications
      ),
      value: getNearbyPlanningApplicationsValue(
        processedPremiumData?.nearbyPlanningApplications
      ),
      askAgentMessage: "I noticed there are quite a few planning permissions on property nearby. Is there anything I should know about this?",
      toolTipExplainer:
        "Planning permission is a key aspect of property regulation in the UK.\n\n" +
        "It typically applies to the specific property and its immediate surroundings, ensuring that any proposed alterations or developments align with local council guidelines.\n\n" +
        "Reviewing the planning permission history can reveal existing restrictions or opportunities for future renovations, which is crucial information when buying a property. ",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Service Charge",
      key: "serviceCharge",
      status:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? getStatusFromString(propertyData.serviceCharge)
          : DataStatus.NOT_APPLICABLE,
      value: propertyData.tenure?.toLowerCase() === "leasehold"
        ? propertyData.serviceCharge
        : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the service charge per annum?",
      toolTipExplainer:
        "A fee paid by leaseholders (usually flats) for the upkeep of communal areas and services.\n\n" +
        "Review what it covers, historical costs, and any planned major works that could increase future charges.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: propertyData.tenure?.toLowerCase() === "leasehold" ? true : false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Ground Rent",
      key: "groundRent",
      status:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? getStatusFromString(propertyData.groundRent)
          : DataStatus.NOT_APPLICABLE,
      value:
        propertyData.tenure?.toLowerCase() === "leasehold"
          ? propertyData.groundRent
          : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the ground rent per annum?",
      toolTipExplainer:
        "An annual fee paid by leaseholders to the freeholder for the use of the land the property sits on.\n\n" +
        "Check the amount, review schedule, and terms, as high or escalating ground rents can be problematic.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: propertyData.tenure?.toLowerCase() === "leasehold" ? true : false,
    },
    // Risks
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Coastal Erosion",
      key: "coastalErosion",
      status: propertyData.coastalErosion.status ?? DataStatus.ASK_AGENT,
      value: propertyData.coastalErosion.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.coastalErosion.reason ?? "",
      toolTipExplainer: "Information about the property's risk from coastal erosion, relevant for seaside properties.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: true,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Detailed Flood Risk Assessment",
      key: "detailedFloodRiskAssessment",
      status: getStatusFromPremium(processedPremiumData?.detailedFloodRiskAssessment),
      value: processedPremiumData?.detailedFloodRiskAssessment ?
        <FloodRiskDisplay floodRisk={processedPremiumData?.detailedFloodRiskAssessment} />
        : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "A comprehensive report assessing the property's specific flood risk from rivers, sea, surface water, and groundwater.\n\n" +
        "Provides more detail than basic checks, crucial for insurance and understanding potential mitigation needs.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Airport Noise Assessment",
      key: "airportNoiseAssessment",
      status: hasPremiumDataLoadedSuccessfully
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: hasPremiumDataLoadedSuccessfully
        ? processedPremiumData?.airportNoiseAssessment?.category ?? "No noise"
        : CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "",
      toolTipExplainer:
        "Evaluates the level of noise pollution from nearby airports and flight paths.\n\n" +
        "Significant noise can impact quality of life and potentially property value.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Coastal Erosion Risk (Detailed)",
      key: "coastalErosionRiskDetailed",
      status: getStatusFromPremium(processedPremiumData?.coastalErosionRisk),
      value: processedPremiumData?.coastalErosionRisk?.can_have_erosion_plan ? "Plan Possible" : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer: "Detailed assessment of coastal erosion risk, indicating if mitigation plans might be applicable.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Defences",
      key: "floodDefences",
      status: getStatusFromBoolean(propertyData.floodDefences),
      value: getYesNoOrAskAgentStringFromBoolean(propertyData.floodDefences),
      askAgentMessage: "Any flood defences?",
      toolTipExplainer:
        "Flood defences help protect the property from water damage.\n\n" +
        "It's important to check if the property is at risk of flooding or has a history of flooding, as this can impact insurance and value.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flood Sources",
      key: "floodSources",
      status:
        (propertyData.floodSources ?? []).length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value:
        (propertyData.floodSources ?? []).length > 0
          ? (propertyData.floodSources?.join(", ") ?? CHECKLIST_NO_VALUE.NOT_MENTIONED)
          : CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Any flood sources?",
      toolTipExplainer:
        "Flood sources are the natural or man-made features that contribute to flooding, such as rivers, streams, dams, or levees.\n\n" +
        "Understanding the flood sources can help assess the property's risk of flooding and the effectiveness of flood defences.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Flooded in last 5 years",
      key: "floodedInLastFiveYears",
      status: getStatusFromBoolean(propertyData.floodedInLastFiveYears, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        propertyData.floodedInLastFiveYears
      ),
      askAgentMessage: "Flooded in last 5 years?",
      toolTipExplainer:
        "A history of flooding can impact property value and insurance.\n\n" +
        "Buyers should check for any past flooding incidents and existing flood defences.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Building Safety",
      key: "buildingSafety",
      status: propertyData.buildingSafety.status ?? DataStatus.ASK_AGENT,
      value: propertyData.buildingSafety.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.buildingSafety.reason ?? "",
      toolTipExplainer:
        "This item identifies building safety information by scanning for key terms. " +
        "Positive terms such as 'Fire Alarm System' indicate robust safety measures, while negative terms (e.g. 'Mould') " +
        "may flag potential concerns. The absence of any mention means further clarification might be needed.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Mining Impact",
      key: "miningImpact",
      status: propertyData.miningImpact.status ?? DataStatus.ASK_AGENT,
      value: propertyData.miningImpact.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: propertyData.miningImpact.reason ?? "",
      toolTipExplainer:
        "Mining impact refers to the impact of mining on the property and the surrounding area.\n\n" +
        "It's important to check the mining impact to ensure the property is not at risk of mining subsidence or other mining-related risks.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },

    // Neighbourhood (Restore full tooltips)
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Crime Score",
      key: "crimeScore",
      status: getCrimeScoreStatus(isCrimeScoreLoading, crimeScoreData),
      value: getCrimeScoreValue(isCrimeScoreLoading, crimeScoreData, crimeScoreError),
      askAgentMessage: "What is the local crime rate like?",
      toolTipExplainer:
        "Provides an overview of reported crime statistics near the property, indicating general neighbourhood safety.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Nearest Stations",
      key: "nearestStations",
      status:
        propertyData.nearestStations && propertyData.nearestStations.length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value:
        propertyData.nearestStations && propertyData.nearestStations.length > 0 ? (
          <>
            {propertyData.nearestStations.map((station, index) => (
              <React.Fragment key={station.name}>
                {`• ${station.name} (${station.distance.toFixed(1)} ${station.unit})`}
                {index < propertyData.nearestStations.length - 1 && <br />}
              </React.Fragment>
            ))}
          </>
        ) : (
          CHECKLIST_NO_VALUE.NOT_MENTIONED
        ),
      askAgentMessage: "What are the nearest train/tram/tube stations and how far are they?",
      toolTipExplainer:
        "Proximity to public transport stations is crucial for commuting and accessibility.\n\n" +
        "Knowing the distance to the nearest stations helps evaluate travel times and convenience.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Nearby Schools",
      key: "nearbySchools",
      status:
        propertyData.nearbySchools && propertyData.nearbySchools.length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: (() => {
        if (!propertyData.nearbySchools || propertyData.nearbySchools.length === 0) {
          return CHECKLIST_NO_VALUE.NOT_MENTIONED;
        }
        const topSchools = [...propertyData.nearbySchools]
          .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
          .slice(0, 4);

        // Return a structured list using Tailwind classes, WITH distance aligned right
        return (
          <div className="flex flex-col gap-3 w-full"> {/* Container with gap */}
            {topSchools.map((school) => (
              <div key={school.name} className="flex justify-between items-start gap-2 w-full">
                <div className="flex flex-col flex-grow mr-2">
                  <span className="font-medium text-sm text-gray-800">{school.name}</span>
                  <div className="flex flex-wrap gap-x-2 text-xs text-gray-500">
                    {school.type && <span>{school.type}</span>}
                    {school.ratingLabel && (
                      <span>
                        {school.ratingLabel}
                      </span>
                    )}
                    {school.distance !== null && school.unit && (
                      <span className="text-sm text-gray-600 whitespace-nowrap pl-2 flex-shrink-0">
                        {`${school.distance.toFixed(1)} ${school.unit}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })(),
      askAgentMessage: "What are the nearest schools and their Ofsted ratings?",
      toolTipExplainer:
        "Proximity to well-regarded schools is often a key factor for families.\\n\\n" +
        "This shows the closest schools found based on the listing information, including their rating (e.g., Ofsted) and distance.",
      isUnlockedWithPremium: false,
      isBoostedWithPremium: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Police Force Proximity",
      key: "policeForceProximity",
      status: getStatusFromPremium(processedPremiumData?.policeForceProximity),
      value: processedPremiumData?.policeForceProximity ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "Information about the nearest police station and local policing team presence.\n\n" +
        "Can be relevant for understanding community safety resources and response times.",
      isUnlockedWithPremium: true,
      isBoostedWithPremium: false,
    },
  ];

  // Filter out items not applicable based on property type AND filter out nulls
  const filteredChecklist = checklist.filter((item): item is PropertyDataListItem => {
    if (!item) return false; // Explicitly filter out nulls here with type predicate
    if (item.key === 'councilTax' && propertyData.propertyType === 'Commercial') {
      return false;
    }
    return true;
  });

  return filteredChecklist;
}
