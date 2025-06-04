import { getNearbyPlanningApplicationsStatus, getNearbyPlanningApplicationsValue, getPropertyPlanningApplicationsStatus, getPropertyPlanningApplicationsValue } from "@/components/ui/Premium/PlanningPermission/helpers";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { PropertyGroups } from "@/constants/propertyConsts";
import { LOW_TURNOVER_THRESHOLD } from "@/constants/scoreConstants";
import { volatilityThreshold } from "@/constants/thresholds";
import { CrimeScoreData, getCrimeScoreStatus, getCrimeScoreValue } from "@/hooks/useCrimeScore";
import { getConstructionMaterialValue } from "@/sidepanel/propertychecklist/constructionMaterialHelpers";
import { BaseChecklistListItem } from "@/types/baseChecklist";
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
  PropertyDataListItem
} from "../../types/property";
import { generateConsolidatedFloodRiskItem } from "./floodRiskHelpers";
import {
  generateEpcChecklistItem,
  getCAGRStatus,
  getRestrictiveCovenantMessages,
  getRestrictiveCovenantsStatus,
  getRestrictiveCovenantsValue,
  getStatusFromBoolean,
  getVolatilityStatus,
  getYesNoOrAskAgentStringFromBoolean,
  getYesNoOrMissingStatus,
  priceDiscrepancyMessages,
} from "./helpers";

export function generatePropertyChecklist(
  propertyData: ExtractedPropertyScrapingData,
  crimeScoreQuery: UseQueryResult<CrimeScoreData, Error> | undefined,
  preprocessedData: PreprocessedData,
  isPremiumDataFetchedAndHasData: boolean
): PropertyDataListItem[] {
  if (!propertyData) {
    console.error('No property data provided to generatePropertyChecklist');
    return [];
  }

  const {
    isPreprocessedDataLoading,
    preprocessedDataError,
    processedPremiumData,
    finalEpcBandData,
    finalEpcValue,
    finalEpcConfidence,
    finalEpcSource,
    calculatedLeaseMonths,
    broadbandDisplayValue,
    broadbandStatus,
    listingHistoryStatus,
    listingHistoryDisplayValue,
    privateRightOfWayObligation,
    publicRightOfWayObligation,
    listedProperty,
    restrictiveCovenants,
    mobileServiceCoverageWithScoreAndLabel,
    completeFloodRiskAssessment,
    processedConservationArea,
  } = preprocessedData;

  const hasPremiumDataLoadedSuccessfully = processedPremiumData?.status === "success"
  const isLeasehold = propertyData.tenure?.toLowerCase() === "leasehold"

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

  const epcChecklistItem = generateEpcChecklistItem(
    propertyData.epc,
    isPreprocessedDataLoading,
    preprocessedDataError,
    finalEpcValue,
    finalEpcConfidence,
    finalEpcSource,
    finalEpcBandData
  );

  // --- Generate Lease Term Checklist Item --- (Directly)
  const baseLeaseItem: BaseChecklistListItem = {
    label: "Remaining Lease Term",
    key: CHECKLIST_KEYS.LEASE_TERM,
    checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
    isExpectedInPremiumSearchData: isLeasehold,
    isExpectedInListing: false,
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

    if (askingVsEstimatePercentage && askingVsEstimateAbsolute) {
      const isUndervalued = askingVsEstimateAbsolute > 0;
      const formattedPercentage = Math.abs(askingVsEstimatePercentage).toFixed(1);
      const formattedAbsolute = formatCurrencyGBP(Math.abs(askingVsEstimateAbsolute));
      const valueString = `${formattedPercentage}% (${formattedAbsolute}) ${isUndervalued ? "undervalued" : "overvalued"}`;
      const signficantlyOvervalued = askingVsEstimatePercentage < -10;

      return {
        key: CHECKLIST_KEYS.ASKING_VS_ESTIMATE_COMPARISON,
        label: "Asking Price vs Estimate",
        value: valueString,
        status: signficantlyOvervalued
          ? DataStatus.ASK_AGENT
          : DataStatus.FOUND_POSITIVE,
        checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
        askAgentMessage: "", // For reference only.
        toolTipExplainer: `Compares the asking price to the estimated market value. ${isUndervalued ? "Undervalued properties may represent better immediate value." : "Overvalued properties might indicate a seller's high expectation or unique features not captured by the estimate."}`,
        isExpectedInPremiumSearchData: true,
        isExpectedInListing: false,
      };
    } else {
      // Premium data unavailable: Show placeholder
      return {
        key: CHECKLIST_KEYS.ASKING_VS_ESTIMATE_COMPARISON,
        label: "Asking Price vs Estimate",
        value: CHECKLIST_NO_VALUE.NOT_AVAILABLE,
        status: DataStatus.ASK_AGENT,
        checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
        askAgentMessage: "",
        toolTipExplainer: "Compares the asking price to the estimated market value. Comparison requires Estimated Sale Value (Premium Data Feature).",
        isExpectedInPremiumSearchData: true,
        isExpectedInListing: false,
      };
    }
  })();

  const restrictiveCovenantStatus = getRestrictiveCovenantsStatus(
    restrictiveCovenants,
    isPreprocessedDataLoading
  );

  const covenantsWereFound = Array.isArray(restrictiveCovenants) && restrictiveCovenants.length > 0;

  const restrictiveCovenantItemMessages = getRestrictiveCovenantMessages(
    restrictiveCovenantStatus,
    covenantsWereFound
  );

  // Generate the consolidated flood risk item by calling the helper
  const consolidatedFloodRiskItem = generateConsolidatedFloodRiskItem({
    preprocessedData,
    CHECKLIST_NO_VALUE,
    completeFloodRiskAssessment,
    isPremiumDataFetchedAndHasData
  });

  const checklist: (PropertyDataListItem | null)[] = [
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Price",
      key: CHECKLIST_KEYS.PRICE,
      status: getStatusFromString(propertyData.salePrice),
      value: propertyData.salePrice,
      askAgentMessage: "What's the price?",
      toolTipExplainer:
        "Knowing the purchase price means you can work out the total cost of buying the property.\n\n" +
        "Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Tenure",
      key: CHECKLIST_KEYS.TENURE,
      status: getStatusFromString(propertyData.tenure),
      value: capitaliseFirstLetterAndCleanString(
        propertyData.tenure
        ?? processedPremiumData?.tenure
        ?? ""
      ),
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations.\n\n" +
        "Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure.\n\n" +
        "Each tenure type has different responsibilities, rights, and costs associated with it.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Location",
      key: CHECKLIST_KEYS.LOCATION,
      status: getStatusFromString(propertyData.address.displayAddress),
      value: propertyData.address.displayAddress,
      askAgentMessage: "Where's the property located?",
      toolTipExplainer:
        "Location is a critical factor in property valuation and desirability.\n\n" +
        "It affects accessibility to amenities, schools, and transport links, and can influence the property's future value.\n\n" +
        "A prime location can enhance lifestyle and convenience, while also impacting safety and community engagement.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Property Type",
      key: CHECKLIST_KEYS.PROPERTY_TYPE,
      status: getStatusFromString(propertyData.propertyType),
      value: propertyData.propertyType
        ?? processedPremiumData?.propertyType
        ?? "",
      askAgentMessage: "What's the property type?",
      toolTipExplainer:
        "Property type refers to the category of the property, such as residential, commercial, or mixed-use.\n\n" +
        "It can also include specific types like flats, houses, or apartments.\n\n" +
        "Understanding the property type helps in assessing its value, potential use, and market demand.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Accessibility",
      key: CHECKLIST_KEYS.ACCESSIBILITY,
      status: getStatusFromString(propertyData.accessibility),
      value: propertyData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs.\n\n" +
        "Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Listing history",
      key: CHECKLIST_KEYS.LISTING_HISTORY,
      status: listingHistoryStatus ?? DataStatus.ASK_AGENT,
      value: listingHistoryDisplayValue ?? CHECKLIST_NO_VALUE.NO_SALES_HISTORY,
      askAgentMessage: "",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market.\n\n" +
        "This can indicate whether the property has been difficult to sell or if it has had price reductions.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.GENERAL,
      label: "Occupancy Status",
      key: CHECKLIST_KEYS.OCCUPANCY_STATUS,
      status: getStatusFromPremium(processedPremiumData?.occupancyStatus),
      value: processedPremiumData?.occupancyStatus ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "Indicates if the property is currently owner-occupied or rented out.\n\n" +
        "This can affect availability for viewing and moving in, and potentially indicate property condition based on tenure history.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },

    // Investment Potential
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Price Change from last sale",
      key: CHECKLIST_KEYS.PRICE_DISCREPANCY,
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
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    askingVsEstimatePriceComparisonItem,
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Historical Compound Annual Growth Rate (CAGR)",
      key: CHECKLIST_KEYS.COMPOUND_ANNUAL_GROWTH_RATE,
      status: getCAGRStatus(propertyData.salesHistory.compoundAnnualGrowthRate),
      value:
        propertyData.salesHistory.compoundAnnualGrowthRate !== null &&
          typeof propertyData.salesHistory.compoundAnnualGrowthRate === "number"
          ? `${(propertyData.salesHistory.compoundAnnualGrowthRate * 100).toFixed(2)}%`
          : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
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
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Volatility",
      key: CHECKLIST_KEYS.VOLATILITY,
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
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Sale Value",
      key: CHECKLIST_KEYS.ESTIMATED_SALE_VALUE,
      status: getStatusFromPremium(processedPremiumData?.estimatedSaleValue),
      value: formatCurrencyGBP(processedPremiumData?.estimatedSaleValue),
      askAgentMessage: "",
      toolTipExplainer:
        "An automated valuation model (AVM) estimate of the property's current market value.\n\n" +
        "Useful as a benchmark against the asking price, but accuracy can vary based on data availability and property uniqueness.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Rental Value",
      key: CHECKLIST_KEYS.ESTIMATED_RENTAL_VALUE,
      status: getStatusFromPremium(processedPremiumData?.estimatedRentalValue),
      value: formatCurrencyGBP(processedPremiumData?.estimatedRentalValue),
      askAgentMessage: "",
      toolTipExplainer:
        "An estimate of the potential monthly rent the property could achieve in the current market.\n\n" +
        "Important for buy-to-let investors to assess potential income and returns.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Estimated Annual Rental Yield",
      key: CHECKLIST_KEYS.ESTIMATED_ANNUAL_RENTAL_YIELD,
      status: getStatusFromPremium(processedPremiumData?.estimatedAnnualRentalYield),
      value: formatPercentage(processedPremiumData?.estimatedAnnualRentalYield),
      askAgentMessage: "",
      toolTipExplainer:
        "Calculates the potential annual rental income as a percentage of the property's estimated value.\n\n" +
        "A key metric for investors comparing the profitability of different property investments.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Sell",
      key: CHECKLIST_KEYS.PROPENSITY_TO_SELL,
      status: getStatusFromPremium(processedPremiumData?.propensityToSell),
      value:
        processedPremiumData && processedPremiumData.propensityToSell !== null
          ? formatPercentage(processedPremiumData.propensityToSell)
          : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of how likely similar properties in the area are to be listed for sale.\n\n" +
        "Can reflect market liquidity and potential competition or availability.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Propensity To Let",
      key: CHECKLIST_KEYS.PROPENSITY_TO_LET,
      status: getStatusFromPremium(processedPremiumData?.propensityToLet),
      value:
        processedPremiumData && processedPremiumData.propensityToLet !== null
          ? formatPercentage(processedPremiumData.propensityToLet)
          : CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "An indicator of the likelihood that similar properties in the area are listed for rent.\n\n" +
        "Reflects the strength of the local rental market and potential for buy-to-let investment.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Market Activity (Turnover Rate)",
      key: CHECKLIST_KEYS.MARKET_TURNOVER_RATE,
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
      askAgentMessage: isPremiumDataFetchedAndHasData ? "Market turnover seems low (<3%). Is there a reason for this?" : "",
      toolTipExplainer:
        "Compares the number of sales in the last 12 months to the total number of properties in the postcode area (e.g., M5).\n\n" +
        "A higher percentage (turnover rate) indicates a more liquid/active market. Typical UK average is around 4-5%.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INVESTMENT_POTENTIAL,
      label: "Outcode Average Sales Price",
      key: CHECKLIST_KEYS.OUTCODE_AVG_SALES_PRICE,
      status: getStatusFromPremium(processedPremiumData?.outcodeAvgSalesPrice),
      value: formatCurrencyGBP(processedPremiumData?.outcodeAvgSalesPrice),
      askAgentMessage: "",
      toolTipExplainer:
        "The average price properties sold for within the outcode over a recent period.\n\n" +
        "Provides a general benchmark for property values in the area.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    // Utilities
    epcChecklistItem,
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Heating",
      key: CHECKLIST_KEYS.HEATING_TYPE,
      status: getStatusFromString(propertyData.heating),
      value: processedPremiumData?.constructionMaterials?.heating ?? propertyData.heating,
      askAgentMessage: "What type of heating system?",
      toolTipExplainer: "The type of heating system used in the property, such as gas central heating, electric heating, or oil-fired heating.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
      hasMoreDetailsInPremiumThanListingValue: true,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Broadband Speed",
      key: CHECKLIST_KEYS.BROADBAND,
      status: broadbandStatus ?? DataStatus.ASK_AGENT,
      value: broadbandDisplayValue ?? processedPremiumData?.broadbandSpeedLabel ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "What is the broadband speed?",
      toolTipExplainer: "Broadband speed impacts internet usage for work, streaming, and gaming.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Mobile Coverage",
      key: CHECKLIST_KEYS.MOBILE_COVERAGE,
      status: getStatusFromPremium(processedPremiumData?.mobileServiceCoverage),
      mobileCoverage: mobileServiceCoverageWithScoreAndLabel,
      askAgentMessage: "",
      toolTipExplainer: "Information on the signal strength and availability of major mobile network providers at the property.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
      value: ""
    },
    {
      checklistGroup: PropertyGroups.UTILITIES,
      label: "Council Tax Band",
      key: CHECKLIST_KEYS.COUNCIL_TAX,
      status: getStatusFromString(propertyData.councilTax, ["tbc"]),
      value: propertyData.councilTax,
      askAgentMessage: "What council tax band?",
      toolTipExplainer:
        "Council tax is a payment to the local authority for services like schools and waste collection.\n\n" +
        "Council tax bands are based on property value, and some exemptions apply (e.g., students).",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },

    // Interior
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bedrooms",
      key: CHECKLIST_KEYS.BEDROOMS,
      status: getStatusFromString(propertyData.bedrooms),
      value: propertyData.bedrooms,
      askAgentMessage: "How many bedrooms?",
      toolTipExplainer: "The number of bedrooms in the property, a key factor in determining its size and value.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Bathrooms",
      key: CHECKLIST_KEYS.BATHROOMS,
      status: getStatusFromString(propertyData.bathrooms),
      value: propertyData.bathrooms,
      askAgentMessage: "How many bathrooms?",
      toolTipExplainer: "The number of bathrooms in the property, impacting convenience and overall value.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Size",
      key: CHECKLIST_KEYS.SIZE,
      status: getStatusFromString(propertyData.size),
      value: propertyData.size,
      askAgentMessage: "What's the size?",
      toolTipExplainer:
        "The size of a property refers to the total area of the property, including all habitable rooms and spaces.\n\n" +
        "It is a key factor in determining the property's value, as larger properties generally have higher value.\n\n" +
        "Size can also impact the property's energy efficiency and maintenance costs.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Floor Plan",
      key: CHECKLIST_KEYS.FLOOR_PLAN,
      status: getStatusFromString(propertyData.floorPlan),
      value: DOMPurify.sanitize(propertyData.floorPlan ?? ""),
      askAgentMessage: "Do you have a floor plan?",
      toolTipExplainer:
        "A floor plan is a detailed layout of the property's interior spaces, including rooms, hallways, and other features.\n\n" +
        "It provides a visual representation of the property's layout and can be useful for understanding the property's size, layout, and potential for renovation or extension.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Materials",
      key: CHECKLIST_KEYS.CONSTRUCTION_MATERIALS,
      status: getStatusFromPremium(processedPremiumData?.constructionMaterials),
      value: getConstructionMaterialValue(processedPremiumData?.constructionMaterials ?? {}),
      askAgentMessage: "",
      toolTipExplainer:
        "The primary materials used to build the property (e.g., brick, timber frame, concrete).\n\n" +
        "Affects insulation, maintenance requirements, longevity, and potentially mortgageability or insurance.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.INTERIOR,
      label: "Construction Age Band",
      key: CHECKLIST_KEYS.CONSTRUCTION_AGE_BAND,
      status: getStatusFromPremium(processedPremiumData?.constructionAgeBand),
      value: processedPremiumData?.constructionAgeBand ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: "",
      toolTipExplainer:
        "The approximate period when the property was built (e.g., pre-1900, 1950s, 2000s).\n\n" +
        "Influences architectural style, potential need for renovations, energy efficiency, and presence of period features.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },

    // Exterior
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: CHECKLIST_KEYS.PARKING,
      status: getStatusFromString(propertyData.parking),
      value: propertyData.parking,
      askAgentMessage: "What parking is available?",
      toolTipExplainer: "Details about parking availability, such as driveway, garage, or on-street parking permits.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Garden",
      key: CHECKLIST_KEYS.GARDEN,
      status: getYesNoOrMissingStatus(propertyData.garden),
      value: propertyData.garden ?? CHECKLIST_NO_VALUE.NOT_MENTIONED,
      askAgentMessage: "Is there a garden?",
      toolTipExplainer:
        "A garden is a private outdoor space associated with a property, providing a place for relaxation, entertainment, and gardening.\n\n" +
        "It can range from a small patio or balcony to a large garden with various features like lawns, trees, and outdoor living areas.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.EXTERIOR,
      label: "Windows",
      key: CHECKLIST_KEYS.WINDOWS,
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
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },

    // Rights & Restrictions
    leaseTermChecklistItem,
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictive Covenants",
      key: CHECKLIST_KEYS.RESTRICTIVE_COVENANTS,
      status: restrictiveCovenantStatus,
      value: getRestrictiveCovenantsValue(
        restrictiveCovenants,
        isPreprocessedDataLoading
      ),
      restrictiveCovenants: restrictiveCovenants,
      askAgentMessage: restrictiveCovenantItemMessages.askAgentMessage,
      toolTipExplainer: restrictiveCovenantItemMessages.toolTipExplainer,
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Listed Property",
      key: CHECKLIST_KEYS.LISTED_PROPERTY,
      status: (() => {
        if (listedProperty === null) {
          return DataStatus.ASK_AGENT; // Unknown status
        } else if (listedProperty.length === 0) {
          return DataStatus.FOUND_POSITIVE; // Confirmed not listed
        } else {
          // Potentially listed (placeholder exists), details unknown
          return DataStatus.ASK_AGENT;
        }
      })(),
      value: (() => {
        if (listedProperty === null) {
          return CHECKLIST_NO_VALUE.NOT_MENTIONED;
        } else if (listedProperty.length === 0) {
          return "No";
        } else {
          // Try to get grade from placeholder if available, otherwise just "Yes"
          const grade = listedProperty[0]?.grade;
          return grade ? `Yes - (${grade})` : "Yes";
        }
      })(),
      askAgentMessage: (() => {
        if (listedProperty && listedProperty.length > 0) {
          return "Are there any important details or restrictions I should know as it's potentially a listed property?";
        }
        // Ask if status is unknown or confirmed not listed (though latter shouldn't need asking)
        return "Is the property listed?";
      })(),
      toolTipExplainer: "Indicates if the property is listed (Grade I, II*, II), which imposes restrictions on alterations.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Public Right of Way Obligation",
      key: CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY,
      status: publicRightOfWayObligation?.exists === false
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: publicRightOfWayObligation?.exists === true
        ? "Yes"
        : publicRightOfWayObligation?.exists === false
          ? "No"
          : CHECKLIST_NO_VALUE.NOT_MENTIONED,
      publicRightOfWay: publicRightOfWayObligation,
      askAgentMessage: "",
      toolTipExplainer: "Indicates if a public footpath or bridleway crosses the property land.",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Private Right of Way Obligation",
      key: CHECKLIST_KEYS.PRIVATE_RIGHT_OF_WAY,
      status: getStatusFromBoolean(privateRightOfWayObligation),
      value: getYesNoOrAskAgentStringFromBoolean(privateRightOfWayObligation),
      askAgentMessage: "",
      toolTipExplainer: "Indicates if a private footpath or bridleway crosses the property land.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Conservation Area Status",
      key: CHECKLIST_KEYS.CONSERVATION_AREA_STATUS,
      status: processedConservationArea?.status ?? DataStatus.ASK_AGENT,
      value: processedConservationArea?.displayValue ?? CHECKLIST_NO_VALUE.NOT_AVAILABLE,
      askAgentMessage: processedConservationArea?.isInArea
        ? "The property is in a conservation area. What are the specific implications or restrictions for this property?"
        : (processedConservationArea?.status === DataStatus.ASK_AGENT)
          ? "Is the property in a conservation area?"
          : "",
      toolTipExplainer: `Indicates if the property is within a conservation area. Being in a conservation area typically adds controls over demolition, new construction, alterations to existing buildings, and work on trees. ${processedConservationArea?.isInArea ? "This property is reported to be in one." : ((processedConservationArea?.status !== DataStatus.ASK_AGENT && processedConservationArea?.status !== DataStatus.IS_LOADING)) ? "This property is reported as not being in one." : "Status could not be determined from available data."}`,
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Property Planning Permissions",
      key: CHECKLIST_KEYS.PLANNING_PERMISSIONS,
      status: getPropertyPlanningApplicationsStatus(
        processedPremiumData?.propertyPlanningApplications,
        isPremiumDataFetchedAndHasData
      ),
      value: getPropertyPlanningApplicationsValue(
        processedPremiumData?.propertyPlanningApplications,
      ),
      askAgentMessage: "I noticed there are quite a few planning permissions on the property. Do you have more information on this?",
      toolTipExplainer:
        "Planning permission is a key aspect of property regulation in the UK.\n\n" +
        "It typically applies to the specific property and its immediate surroundings, ensuring that any proposed alterations or developments align with local council guidelines.\n\n" +
        "Reviewing the planning permission history can reveal existing restrictions or opportunities for future renovations, which is crucial information when buying a property. ",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Nearby Planning Permissions",
      key: CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS,
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
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Service Charge",
      key: CHECKLIST_KEYS.SERVICE_CHARGE,
      status:
        isLeasehold
          ? propertyData.serviceCharge !== null
            ? DataStatus.FOUND_POSITIVE
            : DataStatus.ASK_AGENT
          : DataStatus.NOT_APPLICABLE,
      value: isLeasehold
        ? propertyData.serviceCharge !== null
          ? `${formatCurrencyGBP(propertyData.serviceCharge)} pa`
          : CHECKLIST_NO_VALUE.NOT_MENTIONED
        : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the service charge per annum?",
      toolTipExplainer:
        "A fee paid by leaseholders (usually flats) for the upkeep of communal areas and services.\n\n" +
        "Review what it covers, historical costs, and any planned major works that could increase future charges.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: isLeasehold,
    },
    {
      checklistGroup: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Ground Rent",
      key: CHECKLIST_KEYS.GROUND_RENT,
      status:
        isLeasehold
          ? getStatusFromString(propertyData.groundRent)
          : DataStatus.NOT_APPLICABLE,
      value:
        isLeasehold
          ? propertyData.groundRent
          : CHECKLIST_NO_VALUE.NOT_APPLICABLE,
      askAgentMessage: "What is the ground rent per annum?",
      toolTipExplainer:
        "An annual fee paid by leaseholders to the freeholder for the use of the land the property sits on.\n\n" +
        "Check the amount, review schedule, and terms, as high or escalating ground rents can be problematic.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: isLeasehold,
    },
    // Risks
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Coastal Erosion",
      key: CHECKLIST_KEYS.COASTAL_EROSION,
      status: propertyData.coastalErosion.status ?? DataStatus.ASK_AGENT,
      coastalErosionDetails: preprocessedData.coastalErosionForChecklist,
      value: isPremiumDataFetchedAndHasData
        ? preprocessedData?.coastalErosionForChecklist?.valueDisplay ?? propertyData.coastalErosion.value
        : (propertyData.coastalErosion.value ?? CHECKLIST_NO_VALUE.NOT_MENTIONED),
      askAgentMessage: preprocessedData?.coastalErosionForChecklist?.reasonForAskAgent ?? propertyData.coastalErosion.reason ?? "",
      toolTipExplainer: "Coastal Erosion data for properties that are within 1km of a shoreline. Contains the 2 nearest coastal erosion plans to the property",
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
      hasMoreDetailsInPremiumThanListingValue: true
    },
    {
      checklistGroup: PropertyGroups.RISKS,
      label: "Airport Noise Assessment",
      key: CHECKLIST_KEYS.AIRPORT_NOISE_ASSESSMENT,
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
      isExpectedInPremiumSearchData: true,
      isExpectedInListing: false,
    },
    consolidatedFloodRiskItem,

    // Neighbourhood
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Crime Score",
      key: CHECKLIST_KEYS.CRIME_SCORE,
      status: getCrimeScoreStatus(isCrimeScoreLoading, crimeScoreData),
      value: getCrimeScoreValue(isCrimeScoreLoading, crimeScoreData, crimeScoreError),
      askAgentMessage: "", // Not expected from listing
      toolTipExplainer:
        "Provides an overview of reported crime statistics near the property, indicating general neighbourhood safety.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: false,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Nearest Stations",
      key: CHECKLIST_KEYS.NEAREST_STATIONS,
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
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
    {
      checklistGroup: PropertyGroups.NEIGHBOURHOOD,
      label: "Nearby Schools",
      key: CHECKLIST_KEYS.NEARBY_SCHOOLS,
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
        "Proximity to well-regarded schools is often a key factor for families. " +
        "This shows the closest schools found based on the listing information, including their rating (e.g., Ofsted) and distance.",
      isExpectedInPremiumSearchData: false,
      isExpectedInListing: true,
    },
  ];

  // Filter out items not applicable based on property type AND filter out nulls
  const filteredChecklist = checklist.filter((item): item is PropertyDataListItem => {
    if (!item) return false; // Explicitly filter out nulls here with type predicate

    // Filter out leasehold-related items if the property is not leasehold
    if (!isLeasehold && (
      item.key === CHECKLIST_KEYS.SERVICE_CHARGE
      || item.key === CHECKLIST_KEYS.GROUND_RENT
    )) {
      return false;
    }

    if (item.value === CHECKLIST_NO_VALUE.NOT_APPLICABLE) return false;

    // Ensure isExpectedInListing has a default value if somehow missed during creation
    if (item.isExpectedInListing === undefined) {
      console.warn(`ChecklistItem ${item.key} is missing isExpectedInListing flag. Defaulting to false.`);
      item.isExpectedInListing = false;
    }
    // Ensure confidence has a default value if missing
    if (item.confidence === undefined) {
      item.confidence = ConfidenceLevels.NONE;
    }

    if (item.key === CHECKLIST_KEYS.COUNCIL_TAX && propertyData.propertyType === 'Commercial') {
      return false;
    }
    return true;
  });

  return filteredChecklist;
}
