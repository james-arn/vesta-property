import { ExtractedPropertyData } from "../types/property";
import { RightmovePageModelType } from "../types/rightmovePageModel";
import { extractInfoFromPageModelKeyFeaturesAndDescription, getBroadbandSpeed as getBroadbandSpeedFromDOM } from "./propertyScrapeHelpers";

export function processRightmovePageModel(pageModel: RightmovePageModelType | null): ExtractedPropertyData | null {
    if (!pageModel) {
        console.error("No page model available");
        return null;
    }
    try {
        const {
            heating: heatingFromUnstructuredText,
            windows: windowsFromUnstructuredText,
            garden: gardenFromUnstructuredText,
            accessibility: accessibilityFromUnstructuredText
        } = extractInfoFromPageModelKeyFeaturesAndDescription(pageModel);
        const epc = (pageModel.propertyData?.epcGraphs?.length ?? 0) > 0 && pageModel.propertyData?.epcGraphs?.[0]?.url
            ? pageModel.propertyData?.epcGraphs?.[0]?.url

            : 'Ask agent';

        const floorPlan = pageModel.propertyData?.floorplans?.length > 0 && pageModel.propertyData?.floorplans?.[0]?.url
            ? pageModel.propertyData?.floorplans?.[0]?.url
            : 'Ask agent';

        return {
            agent: {
                name: pageModel.propertyData.customer.branchDisplayName,
                contactUrl: pageModel.metadata.emailAgentUrl,
            },
            price: pageModel.propertyData.prices.primaryPrice || null,
            location: pageModel.propertyData.address.displayAddress || null,
            propertyType: pageModel.propertyData.propertySubType || null,
            tenure: pageModel.propertyData.tenure.tenureType || null,
            bedrooms: pageModel.propertyData.bedrooms.toString() || null,
            bathrooms: pageModel.propertyData?.bathrooms?.toString() || null,
            parking: pageModel.propertyData.features?.parking?.[0]?.displayText || null,
            garden: pageModel.propertyData.features?.garden?.[0]?.displayText || gardenFromUnstructuredText || 'Ask agent',
            councilTax: pageModel.propertyData.livingCosts.councilTaxBand || null,
            size: pageModel.propertyData.sizings.length > 0
                ? `${Math.ceil(pageModel.propertyData.sizings[0].maximumSize).toLocaleString()} ${pageModel.propertyData.sizings[0].displayUnit} (${Math.ceil(pageModel.propertyData.sizings[0].maximumSize * 10.764).toLocaleString()} sq ft)`
                : 'Ask agent',
            heating: pageModel.propertyData.features?.heating?.[0]?.displayText || heatingFromUnstructuredText || 'Ask agent',
            floorPlan: floorPlan,
            epc: epc,
            broadband: (() => {
                const broadbandFeature = pageModel.propertyData.features?.broadband?.[0]?.displayText;
                const broadbandSpeed = getBroadbandSpeedFromDOM();
                if (broadbandFeature && broadbandSpeed) {
                    return `${broadbandFeature}, ${broadbandSpeed}`;
                }
                else if (broadbandFeature) return broadbandFeature;
                else if (broadbandSpeed) return broadbandSpeed;
                else return 'Ask agent';
            })(),
            listingHistory: pageModel.propertyData?.listingHistory?.listingUpdateReason || 'Ask agent',
            windows: windowsFromUnstructuredText || 'Ask agent',
            publicRightOfWayObligation: pageModel.propertyData.features.obligations.rightsOfWay,
            privateRightOfWayObligation: pageModel.propertyData.features.obligations.requiredAccess,
            listedProperty: pageModel.propertyData.features.obligations.listed,
            restrictions: pageModel.propertyData.features.obligations.restrictions,
            floodDefences: pageModel.propertyData.features.risks.floodDefences,
            floodSources: pageModel.propertyData.features.risks.floodSources,
            floodedInLastFiveYears: pageModel.propertyData.features.risks.floodedInLastFiveYears,
            accessibility: pageModel.propertyData?.features?.accessibility && pageModel.propertyData.features.accessibility.length > 0
                ? pageModel.propertyData.features.accessibility.map(item => item.displayText).join(', ') || accessibilityFromUnstructuredText || 'Ask agent'
                : 'Ask agent',
        };
    } catch (error) {
        console.error("Error processing PAGE_MODEL:", error);
        return null;
    }

}