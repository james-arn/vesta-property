import { RightmovePageModelType } from "../types/rightmovePageModel";
import { capitaliseFirstLetter } from "./text";

export function extractInfoFromText(text: string) {
    const heatingRegex = /\b(?:gas central heating|electric heating|electric central heating|underfloor heating|radiators|boiler)\b/gi;
    const gardenRegex = /\bgarden\b/gi;
    const parkingRegex = /\bparking\b/gi;

    const heatingMatches = text.match(heatingRegex);
    const gardenMatches = text.match(gardenRegex);
    const parkingMatches = text.match(parkingRegex);

    return {
        heating: heatingMatches ? capitaliseFirstLetter([...new Set(heatingMatches)].join(', ')) : null,
        garden: gardenMatches ? [...new Set(gardenMatches)] : null,
        parking: parkingMatches ? [...new Set(parkingMatches)] : null,
    };
}

export function extractInfoFromPageModelKeyFeaturesAndDescription(pageModel: RightmovePageModelType) {
    const keyFeatures = pageModel.propertyData.keyFeatures || '';
    const description = pageModel.propertyData.text.description || '';
    return extractInfoFromText(`${keyFeatures} ${description}`);
}

export const isFloorPlanPresent = () => {
    // Check for the "No floorplan" text
    const noFloorplanText = Array.from(document.querySelectorAll('div')).some((div) =>
        div.innerText.includes('No floorplan')
    );

    if (noFloorplanText) {
        console.log("Floor plan is missing.");
        return false;
    }

    // Check if an <img> tag related to a floor plan exists
    const floorPlanImg = Array.from(document.querySelectorAll('img')).find((img) =>
        img.alt?.toLowerCase().includes('floorplan')
    );

    if (floorPlanImg) {
        console.log("Floor plan is present.");
        return true;
    }

    // Check for links pointing to floor plan
    const floorPlanLink = Array.from(document.querySelectorAll('a')).find((a) =>
        a.href?.includes('#/floorplan')
    );

    if (floorPlanLink) {
        console.log("Floor plan is present.");
        return true;
    }

    console.log("Floor plan is missing.");
    return false;
};

export function clickBroadbandChecker() {
    const broadbandDiv = document.querySelector('div[data-gtm-name="broadband-checker"]');

    if (broadbandDiv) {
        const broadbandButton = broadbandDiv.querySelector('button') as HTMLButtonElement;

        if (broadbandButton) {
            broadbandButton.click();
            console.log("Broadband checker button clicked.");
        } else {
            console.error("Broadband button not found within the broadband checker div.");
        }
    } else {
        console.error("Broadband checker div not found.");
    }
}

export function getBroadbandSpeed(): string | null {
    const broadbandDiv = document.querySelector('div[data-gtm-name="broadband-checker"]');
    if (!broadbandDiv) {
        console.error("Broadband checker div not found.");
        return null;
    }

    console.log("[property scrape helpers] Searching for broadband speed elements.");
    const speedElements = broadbandDiv.querySelectorAll('p');

    console.log("[property scrape helpers] Filtering speed elements to find the one ending with 'Mb'.");
    const speedElement = Array.from(speedElements).find(element =>
        (element.textContent || '').trim().endsWith('Mb')
    );

    const result = speedElement ? speedElement.textContent?.trim() || null : null;
    console.log(`[property scrape helpers] Broadband speed found: ${result}`);
    return result;
}