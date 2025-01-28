import { ExtractedPropertyData } from "../types/property";
import { RightmovePageModelType } from "../types/rightmovePageModel";
import { extractInfoFromPageModelKeyFeaturesAndDescription, getBroadbandSpeed as getBroadbandSpeedFromDOM } from "./propertyScrapeHelpers";

export function processRightmovePageModel(pageModel: RightmovePageModelType | null): ExtractedPropertyData | null {
    if (!pageModel) {
        console.error("No page model available");
        return null;
    }
    try {
        const { heating: heatingFromUnstructuredText, windows: windowsFromUnstructuredText } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);
        const epc = (pageModel.propertyData?.epcGraphs?.length ?? 0) > 0 && pageModel.propertyData?.epcGraphs?.[0]?.url
            ? pageModel.propertyData?.epcGraphs?.[0]?.url
            : 'Ask agent';

        return {
            price: pageModel.propertyData.prices.primaryPrice || null,
            location: pageModel.propertyData.address.displayAddress || null,
            propertyType: pageModel.propertyData.propertySubType || null,
            tenure: pageModel.propertyData.tenure.tenureType || null,
            bedrooms: pageModel.propertyData.bedrooms.toString() || null,
            bathrooms: pageModel.propertyData.bathrooms.toString() || null,
            parking: pageModel.propertyData.features?.parking?.[0]?.displayText || null,
            garden: pageModel.propertyData.features?.garden?.[0]?.displayText || null,
            councilTax: pageModel.propertyData.livingCosts.councilTaxBand || null,
            size: pageModel.propertyData.sizings.length > 0
                ? `${pageModel.propertyData.sizings[0].maximumSize} ${pageModel.propertyData.sizings[0].displayUnit} (${pageModel.propertyData.sizings[0].maximumSize * 10.764} sq ft)`
                : 'Ask agent',
            heating: pageModel.propertyData.features?.heating?.[0]?.displayText || heatingFromUnstructuredText || 'Ask agent',
            floorPlan: pageModel.propertyData.floorplans.length > 0 ? 'Yes' : 'Ask agent',
            epc: epc,
            broadband: pageModel.propertyData.features?.broadband?.[0]?.displayText || getBroadbandSpeedFromDOM() || 'Ask agent',
            listingHistory: pageModel.propertyData?.listingHistory?.listingUpdateReason || 'Ask agent',
            windows: windowsFromUnstructuredText || 'Ask agent'
        };
    } catch (error) {
        console.error("Error processing PAGE_MODEL:", error);
        return null;
    }
}