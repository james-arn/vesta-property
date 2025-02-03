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
        "Knowing the purchase price means you can work out the total cost of buying the property. Not only mortgage payments and deposit, but also any stamp duty, legal and moving costs.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Tenure",
      key: "tenure",
      status: extractedData.tenure
        ? DataStatus.FOUND_POSITIVE
        : DataStatus.ASK_AGENT,
      value: extractedData.tenure,
      askAgentMessage: "What's the tenure?",
      toolTipExplainer:
        "Tenure determines how you legally own the property and any associated costs or obligations. Types include Freehold, Leasehold, Commonhold, Shared Ownership, and Non-traditional Tenure. Each tenure type has different responsibilities, rights, and costs associated with it.",
    },
    {
      group: PropertyGroups.GENERAL,
      label: "Listing history",
      key: "listingHistory",
      status: listingHistoryStatus,
      value: listingHistoryValue,
      askAgentMessage: "What's the listing history?",
      toolTipExplainer:
        "Listing history provides insights into the property's market activity, such as price changes and time on the market. This can indicate whether the property has been difficult to sell or if it has had price reductions.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Parking",
      key: "parking",
      status: getYesNoOrMissingStatus(extractedData.parking),
      value: extractedData.parking ?? "Ask agent",
      askAgentMessage: "Is there parking?",
      toolTipExplainer:
        "Parking can refer to how and where vehicles can be parked, and any associated costs. Factors to consider include whether a parking space is owned by you, if parking is communal, or if a permit is needed.",
    },
    {
      group: PropertyGroups.EXTERIOR,
      label: "Accessibility",
      key: "accessibility",
      status:
        extractedData.accessibility?.toLowerCase() !== agentMissingInfo
          ? DataStatus.FOUND_POSITIVE
          : DataStatus.ASK_AGENT,
      value: extractedData.accessibility,
      askAgentMessage: "Is the property accessible-friendly?",
      toolTipExplainer:
        "Accessibility features make the property suitable for people with mobility needs. Common accessible features include level access, lift access, ramped access, wet rooms, wide doorways, step-free access, level access showers, and lateral living (a property where all key rooms are on the entry level).",
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
        "A listed property is designated as being of architectural or historical interest and requires special permission before being altered. There are three grades of listed buildings: Grade I (exceptional interest), Grade II* (more than special interest), and Grade II (special interest, most common for homes).",
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
        "Public Rights of Way are legal obligations requiring access to private property, such as footpaths or bridleways. Property owners may be responsible for upkeep and work with the council for maintenance.",
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
        "Private Rights of Way allow individuals or companies to access or alter land without requiring permission. Examples include access rights for neighbouring properties or utility companies installing infrastructure.",
    },
    {
      group: PropertyGroups.RISKS,
      label: "Flood Defences",
      key: "floodDefences",
      status: getStatusFromBoolean(extractedData.floodDefences),
      value: getYesNoOrAskAgentStringFromBoolean(extractedData.floodDefences),
      askAgentMessage: "Any flood defences?",
      toolTipExplainer:
        "Flood defences help protect the property from water damage. It's important to check if the property is at risk of flooding or has a history of flooding, as this can impact insurance and value.",
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
        "A history of flooding can impact property value and insurance. Buyers should check for any past flooding incidents and existing flood defences.",
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
        "An Energy Performance Certificate (EPC) provides a property's energy efficiency rating, ranging from A (most efficient) to G (least efficient). An EPC is required before a property is sold or rented and is valid for 10 years.",
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
        "Council tax is a payment to the local authority for services like schools and waste collection. Council tax bands are based on property value, and some exemptions apply (e.g., students).",
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
