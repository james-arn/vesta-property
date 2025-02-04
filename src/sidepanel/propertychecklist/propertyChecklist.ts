import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import DOMPurify from "dompurify";
import {
  DataStatus,
  ExtractedPropertyData,
  PropertyDataList,
  PropertyGroups,
} from "../../types/property";
import {
  calculateListingHistoryDetails,
  getStatusFromBoolean,
  getYesNoOrAskAgentStringFromBoolean,
  getYesNoOrMissingStatus,
} from "./helpers";

const BROADBAND_SPEED_UNDER_10MBS_REGEX = /\b(\d{1,2})\s*mbs\b/i;

export const agentMissingInfo = "ask agent";
export function generatePropertyChecklist(
  extractedData: ExtractedPropertyData
): PropertyDataList[] {
  const { status: listingHistoryStatus, value: listingHistoryValue } =
    calculateListingHistoryDetails(extractedData.listingHistory);

  return [
    {
      group: PropertyGroups.GENERAL,
      label: "Price",
      key: "price",
      status: extractedData.price
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.price,
      askAgentMessage: "What's the price?",
      toolTipExplainer:
        "Knowing the purchase price means you can work out the total cost of buying the property.\n\n" +
        "Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Tenure",
      key: "tenure",
      status: extractedData.tenure
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: capitaliseFirstLetterAndCleanString(extractedData.tenure ?? ""),
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations.\n\n" +
        "Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure.\n\n" +
        "Each tenure type has different responsibilities, rights, and costs associated with it.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Location",
      key: "location",
      status: extractedData.location
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.location,
      askAgentMessage: "Where's the property located?",
      toolTipExplainer:
        "Location is a critical factor in property valuation and desirability.\n\n" +
        "It affects accessibility to amenities, schools, and transport links, and can influence the property's future value.\n\n" +
        "A prime location can enhance lifestyle and convenience, while also impacting safety and community engagement.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Property Type",
      key: "propertyType",
      status: extractedData.propertyType
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.propertyType,
      askAgentMessage: "What's the property type?",
      toolTipExplainer:
        "Property type refers to the category of the property, such as residential, commercial, or mixed-use.\n\n" +
        "It can also include specific types like flats, houses, or apartments.\n\n" +
        "Understanding the property type helps in assessing its value, potential use, and market demand.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Accessibility",
      key: "accessibility",
      status:
        extractedData.accessibility?.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs.\n\n" +
        "Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Listing history",
      key: "listingHistory",
      status: listingHistoryStatus,
      value: listingHistoryValue,
      askAgentMessage: "What's the listing history?",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market.\n\n" +
        "This can indicate whether the property has been difficult to sell or if it has had price reductions.",
    },
    // Interior Details
    {
      group: PropertyGroups.INTERIOR,
      label: "Bedrooms",
      key: "bedrooms",
      status: extractedData.bedrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.bedrooms,
      askAgentMessage: "How many bedrooms?",
      toolTipExplainer:
        "The number of bedrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bedrooms generally indicate a larger living space, which can be more valuable in the housing market.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Bathrooms",
      key: "bathrooms",
      status: extractedData.bathrooms
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.bathrooms,
      askAgentMessage: "How many bathrooms?",
      toolTipExplainer:
        "The number of bathrooms in a property is a key factor in its desirability and value.\n\n" +
        "More bathrooms generally indicate a larger living space, which can be more valuable in the housing market.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Heating Type",
      key: "heatingType",
      status:
        typeof extractedData.heating === "string" &&
        extractedData.heating.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.heating,
      askAgentMessage: "What's the heating type?",
      toolTipExplainer:
        "Heating type refers to the method of heating used in the property, such as gas central heating, electric heating, or underfloor heating.\n\n" +
        "It can also include specific types like boilers, radiators, or heat pumps.\n\n" +
        "Understanding the heating type helps in assessing the property's energy efficiency and comfort.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Size",
      key: "size",
      status:
        typeof extractedData.size === "string" &&
        extractedData.size.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.size,
      askAgentMessage: "What's the size?",
      toolTipExplainer:
        "The size of a property refers to the total area of the property, including all habitable rooms and spaces.\n\n" +
        "It is a key factor in determining the property's value, as larger properties generally have higher value.\n\n" +
        "Size can also impact the property's energy efficiency and maintenance costs.",
    },
    {
      group: PropertyGroups.INTERIOR,
      label: "Floor Plan",
      key: "floorPlan",
      status: extractedData.floorPlan
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: DOMPurify.sanitize(extractedData.floorPlan ?? ""),
      askAgentMessage: "Do you have a floor plan?",
      toolTipExplainer:
        "A floor plan is a detailed layout of the property's interior spaces, including rooms, hallways, and other features.\n\n" +
        "It provides a visual representation of the property's layout and can be useful for understanding the property's size, layout, and potential for renovation or extension.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Garden",
      key: "garden",
      status: getYesNoOrMissingStatus(extractedData.garden),
      value: extractedData.garden ?? "Ask agent",
      askAgentMessage: "Is there a garden?",
      toolTipExplainer:
        "A garden is a private outdoor space associated with a property, providing a place for relaxation, entertainment, and gardening.\n\n" +
        "It can range from a small patio or balcony to a large garden with various features like lawns, trees, and outdoor living areas.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Windows",
      key: "windows",
      status:
        typeof extractedData.windows === "string" &&
        extractedData.windows.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.windows,
      askAgentMessage: "Windows - material & glazing?",
      toolTipExplainer:
        "The key information to know is the materials, such as wood, aluminium, or uPVC, and the glazing, such as single or double-glazed windows.\n\n" +
        "Understanding the window material and glazing can impact the property's energy efficiency and comfort.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: "parking",
      status: getYesNoOrMissingStatus(extractedData.parking),
      value: extractedData.parking ?? "Ask agent",
      askAgentMessage: "Is there parking?",
      toolTipExplainer:
        "Parking can refer to how and where vehicles can be parked, and any associated costs.\n\n" +
        "Factors to consider include whether a parking space is owned by you, if parking is communal, or if a permit is needed.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Listed property",
      key: "listedProperty",
      status: extractedData.listedProperty
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: getYesNoOrAskAgentStringFromBoolean(extractedData.listedProperty),
      askAgentMessage: "Is the property listed?",
      toolTipExplainer:
        "A listed property is designated as being of architectural or historical interest and requires special permission before being altered.\n\n" +
        "There are three grades of listed buildings: Grade I (exceptional interest), Grade II* (more than special interest), and Grade II (special interest, most common for homes).",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Restrictions",
      key: "restrictions",
      status: getStatusFromBoolean(extractedData.restrictions, true),
      value: getYesNoOrAskAgentStringFromBoolean(extractedData.restrictions),
      askAgentMessage: "Any restrictions?",
      toolTipExplainer:
        "Restrictions are legal constraints on what can be done with the property, such as building height limits, conservation area regulations, or planning permissions.\n\n" +
        "These restrictions can impact the property's value and potential use.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Public right of way obligation",
      key: "publicRightOfWayObligation",
      status: getStatusFromBoolean(
        extractedData.publicRightOfWayObligation,
        true
      ),
      value: getYesNoOrAskAgentStringFromBoolean(
        extractedData.publicRightOfWayObligation
      ),
      askAgentMessage: "Public right of way obligation?",
      toolTipExplainer:
        "Public Rights of Way are legal obligations requiring access to private property, such as footpaths or bridleways.\n\n" +
        "Property owners may be responsible for upkeep and work with the council for maintenance.",
    },
    {
      group: PropertyGroups.RIGHTS_AND_RESTRICTIONS,
      label: "Private right of way obligation",
      key: "privateRightOfWayObligation",
      status: getStatusFromBoolean(
        extractedData.privateRightOfWayObligation,
        true
      ),
      value: getYesNoOrAskAgentStringFromBoolean(
        extractedData.privateRightOfWayObligation
      ),
      askAgentMessage: "Private right of way obligation?",
      toolTipExplainer:
        "Private Rights of Way allow individuals or companies to access or alter land without requiring permission.\n\n" +
        "Examples include access rights for neighbouring properties or utility companies installing infrastructure.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flood Defences",
      key: "floodDefences",
      status: getStatusFromBoolean(extractedData.floodDefences),
      value: getYesNoOrAskAgentStringFromBoolean(extractedData.floodDefences),
      askAgentMessage: "Any flood defences?",
      toolTipExplainer:
        "Flood defences help protect the property from water damage.\n\n" +
        "It's important to check if the property is at risk of flooding or has a history of flooding, as this can impact insurance and value.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flood Sources",
      key: "floodSources",
      status:
        (extractedData.floodSources ?? []).length > 0
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value:
        (extractedData.floodSources ?? []).length > 0
          ? (extractedData.floodSources?.join(", ") ?? "Ask agent")
          : "Ask agent",
      askAgentMessage: "Any flood sources?",
      toolTipExplainer:
        "Flood sources are the natural or man-made features that contribute to flooding, such as rivers, streams, dams, or levees.\n\n" +
        "Understanding the flood sources can help assess the property's risk of flooding and the effectiveness of flood defences.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flooded in last 5 years",
      key: "floodedInLastFiveYears",
      status: getStatusFromBoolean(extractedData.floodedInLastFiveYears, true),
      value: getYesNoOrAskAgentStringFromBoolean(
        extractedData.floodedInLastFiveYears
      ),
      askAgentMessage: "Flooded in last 5 years?",
      toolTipExplainer:
        "A history of flooding can impact property value and insurance.\n\n" +
        "Buyers should check for any past flooding incidents and existing flood defences.",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "EPC Certificate",
      key: "epc",
      status: extractedData.epc
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: DOMPurify.sanitize(extractedData.epc ?? ""),
      askAgentMessage: "Do you have the EPC certificate?",
      toolTipExplainer:
        "An Energy Performance Certificate (EPC) provides a property's energy efficiency rating, ranging from A (most efficient) to G (least efficient).\n\n" +
        "An EPC is required before a property is sold or rented and is valid for 10 years.",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "Council Tax Band",
      key: "councilTax",
      status:
        extractedData.councilTax &&
        extractedData.councilTax !== agentMissingInfo &&
        extractedData.councilTax?.toLowerCase() !== "tbc"
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.councilTax,
      askAgentMessage: "What council tax band?",
      toolTipExplainer:
        "Council tax is a payment to the local authority for services like schools and waste collection.\n\n" +
        "Council tax bands are based on property value, and some exemptions apply (e.g., students).",
    },
    {
      group: PropertyGroups.UTILITIES,
      label: "Broadband",
      key: "broadband",
      status: extractedData.broadband
        ? (() => {
            const match = extractedData.broadband.match(
              BROADBAND_SPEED_UNDER_10MBS_REGEX
            );
            return match && parseInt(match[1]) <= 10
              ? DataStatus.ASK_AGENT
              : DataStatus.FOUND_POSITIVE;
          })()
        : DataStatus.ASK_AGENT,
      value: extractedData.broadband,
      askAgentMessage: "How's the broadband speed?",
      toolTipExplainer:
        "Broadband speed refers to the speed of internet connection, measured in megabits per second (Mbps).\n\n" +
        "Faster speeds provide better internet connectivity, allowing for faster downloads, streaming, and online activities.\n\n" +
        "It's important to check the broadband speed to ensure it meets your needs, especially for work, streaming, and gaming.",
    },
    // TODO: ON ROADMAP...
    // building safety
    // coastal erosion
    // impact of mining in the area
    // construction type of the property
    // // Neighbourhood and Environment
    // { group: PropertyGroups.NEIGHBOURHOOD, label: "Noise Levels", key: "noiseLevels", status: DataStatus.ASK_AGENT, value: null },
    // { group: PropertyGroups.NEIGHBOURHOOD, label: "Local Amenities", key: "localAmenities", status: DataStatus.ASK_AGENT, value: null },

    // // Legal and Ownership
    // { group: PropertyGroups.LEGAL, label: "Planning Permissions", key: "planningPermissions", status: DataStatus.ASK_AGENT, value: null },
    // { group: PropertyGroups.LEGAL, label: "Ownership History", key: "ownershipHistory", status: DataStatus.ASK_AGENT, value: null },
  ];
}
