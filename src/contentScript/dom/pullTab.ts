import { logErrorToSentry } from "@/utils/sentry";
import { ActionEvents } from "../../constants/actionEvents";
import { UI } from "../../constants/colors";
import { RIGHTMOVE_PROPERTY_PAGE_REGEX } from "../../constants/regex";
import { Z_INDEX } from "../../constants/zindex";

const VESTA_PULL_TAB_ID = "vesta-pull-tab";
const VESTA_PULL_TAB_LOGO_ID = "vesta-pull-tab-logo";
const VESTA_BOOKMARK_SPINE_ID = "vesta-bookmark-spine";
const VESTA_DYNAMIC_BACKGROUND_ID = "vesta-dynamic-background-fill";
const PULL_TAB_ACTIVE_CLASS = "vesta-pull-tab--panel-open"; // For styling when panel is open

interface PullTabStyles {
  pullTab: string;
  logo: string;
  keyframes: string;
  bookmarkSpine: string;
  dynamicBackground: string;
  pullTabActive?: string;
}

interface PullTabElements {
  tab: HTMLButtonElement;
  spine: HTMLDivElement | null;
  dynamicBg: HTMLDivElement | null;
}

const pullAnimationKeyframes = `
@keyframes vestaPullAnimation {
  0%   { transform: translateY(-50%) translateX(0px); }
  /* Removed a more complex animation in favour of just a background change + side panel open */
  /* For a subtle click effect, we rely on the brief visual change from mousedown/mouseup or a very quick animation */
  50%  { transform: translateY(-50%) translateX(-5px); } /* Slight pull */
  100% { transform: translateY(-50%) translateX(0px); }  /* Back to position */
}
`;

const pullTabStyles: PullTabStyles = {
  keyframes: pullAnimationKeyframes,
  bookmarkSpine: `
    position: fixed;
    right: 0px;
    top: 0px;
    width: 8px;
    height: 100vh;
    background-color: ${UI.BOOKMARK_SPINE.DEFAULT};
    z-index: ${Z_INDEX.BOOKMARK_SPINE}; /* Above dynamic background, below tab */
    pointer-events: none;
    box-sizing: border-box;
    border: none;
    /* Transition for transform will be added via JS */
  `,
  dynamicBackground: `
    position: fixed;
    right: 0px;
    top: 0px;
    width: 0px; /* Initially hidden */
    height: 100vh; /* Or match tab height if preferred */
    background-color: ${UI.BOOKMARK_SPINE.DEFAULT}; /* Same green */
    z-index: ${Z_INDEX.DYNAMIC_BACKGROUND}; /* Behind spine and tab */
    transition: width 0.2s ease-out; /* Animates width */
    pointer-events: none;
    box-sizing: border-box;
    border: none;
  `,
  pullTab: `
    position: fixed;
    right: 7px; /* Right edge slightly overlaps with spine */
    top: 50%;
    transform: translateY(-50%); /* Vertical centering */
    background-color: ${UI.PULL_TAB.DEFAULT}; /* Green tab - effectively the visible part of the spine */
    color: ${UI.PULL_TAB.TEXT};
    border: none;
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    width: 52px; /* The interactive tab part */
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: none; /* Removed shadow to prevent edge artifacts */
    z-index: ${Z_INDEX.PULL_TAB}; /* On top of the track */
    /* padding-left: 8px; Ensure logo is positioned correctly within this tab */
    box-sizing: border-box;
  `,
  // Placeholder for active state - e.g., change background or icon
  pullTabActive: `
    background-color: ${UI.PULL_TAB.ACTIVE}; /* Slightly different green or an icon change */
  `,
  logo: `
    height: 42px; /* Logo height increased to 42px */
    width: auto;
    pointer-events: none;
  `,
};

let keyframesInjected = false;
let isPanelOpenForThisTab = false; // Module-level state for panel
let currentPullTabElement: HTMLButtonElement | null = null; // Keep a reference to the current tab element
let animationsReady = false; // Global animation ready state

const injectKeyframes = (): void => {
  if (keyframesInjected) return;
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = pullTabStyles.keyframes;
  document.head.appendChild(styleSheet);
  keyframesInjected = true;
};

// Function to update pull tab appearance based on panel state
const updatePullTabAppearance = (): void => {
  if (!currentPullTabElement) {
    logErrorToSentry(
      "[pullTab.ts] updatePullTabAppearance: currentPullTabElement is null! Cannot update appearance."
    );
    return;
  }

  if (isPanelOpenForThisTab) {
    currentPullTabElement.classList.add(PULL_TAB_ACTIVE_CLASS);
    currentPullTabElement.setAttribute("aria-label", "Close Vesta Property Inspector");
    currentPullTabElement.style.backgroundColor = UI.PULL_TAB.ACTIVE;
  } else {
    currentPullTabElement.classList.remove(PULL_TAB_ACTIVE_CLASS);
    currentPullTabElement.setAttribute("aria-label", "Open Vesta Property Inspector");
    currentPullTabElement.style.backgroundColor = UI.PULL_TAB.DEFAULT;
  }
};

// Handler functions to keep code clean and maintainable
const handleMouseOver = (elements: PullTabElements): void => {
  if (!animationsReady) return;

  const { tab, spine, dynamicBg } = elements;
  const pullTabOriginalTransform = "translateY(-50%)";
  const hoverTransform = `${pullTabOriginalTransform} translateX(-5px)`;
  const hoverBgColor = UI.PULL_TAB.HOVER;

  tab.style.transform = hoverTransform;
  tab.style.backgroundColor = hoverBgColor;

  if (spine) {
    spine.style.transform = "translateX(-5px)";
    spine.style.backgroundColor = hoverBgColor;
  }

  if (dynamicBg) {
    dynamicBg.style.width = "6px";
    dynamicBg.style.backgroundColor = hoverBgColor;
  }
};

const handleMouseOut = (elements: PullTabElements): void => {
  if (!animationsReady) return;

  const { tab, spine, dynamicBg } = elements;
  const originalBgColor = isPanelOpenForThisTab ? UI.PULL_TAB.ACTIVE : UI.PULL_TAB.DEFAULT;

  tab.style.transform = "translateY(-50%)";
  tab.style.backgroundColor = originalBgColor;

  if (spine) {
    spine.style.transform = "translateX(0px)";
    spine.style.backgroundColor = originalBgColor;
  }

  if (dynamicBg) {
    dynamicBg.style.width = "0px";
    dynamicBg.style.backgroundColor = originalBgColor;
  }
};

const handleTabClick = (): void => {
  if (!currentPullTabElement) return;

  currentPullTabElement.style.animation = `vestaPullAnimation 0.2s ease-in-out`;
  currentPullTabElement.addEventListener(
    "animationend",
    () => {
      if (currentPullTabElement) currentPullTabElement.style.animation = "";
    },
    { once: true }
  );

  if (isPanelOpenForThisTab) {
    chrome.runtime.sendMessage({ action: ActionEvents.REQUEST_SIDE_PANEL_CLOSE_ACTION });
  } else {
    chrome.runtime.sendMessage({ action: ActionEvents.REQUEST_OPEN_SIDE_PANEL });
  }
};

// More reliable initialization - wait for elements to be fully loaded
const initializeInteractions = (elements: PullTabElements): void => {
  const { tab } = elements;

  // Set up event listeners with the extracted handler functions
  tab.addEventListener("mouseover", () => handleMouseOver(elements));
  tab.addEventListener("mouseout", () => handleMouseOut(elements));
  tab.addEventListener("click", handleTabClick);

  // Simple, reliable approach - fixed delay before enabling animations
  // This was working reliably before and prevents jiggling
  animationsReady = false;
  setTimeout(() => {
    animationsReady = true;
  }, 500);
};

export const createAndInjectPullTab = (): void => {
  injectKeyframes();
  removePullTab();

  if (!isOnRightmovePropertyPage()) {
    return;
  }

  // Create all elements
  const dynamicBg = document.createElement("div");
  dynamicBg.id = VESTA_DYNAMIC_BACKGROUND_ID;
  dynamicBg.style.cssText = pullTabStyles.dynamicBackground;

  const bookmarkSpine = document.createElement("div");
  bookmarkSpine.id = VESTA_BOOKMARK_SPINE_ID;
  bookmarkSpine.style.cssText = pullTabStyles.bookmarkSpine;

  const pullTab = document.createElement("button");
  pullTab.id = VESTA_PULL_TAB_ID;
  pullTab.setAttribute("aria-label", "Open Vesta Property Inspector");
  pullTab.style.cssText = pullTabStyles.pullTab;
  currentPullTabElement = pullTab;

  const logo = document.createElement("img");
  logo.id = VESTA_PULL_TAB_LOGO_ID;
  logo.src = chrome.runtime.getURL("images/logo-white-no-text.png");
  logo.alt = "Vesta";
  logo.style.cssText = pullTabStyles.logo;
  pullTab.appendChild(logo);

  // Apply styles not in the CSS template
  pullTab.style.transition = "transform 0.2s ease-out, background-color 0.2s";

  // Add elements to DOM
  document.body.appendChild(dynamicBg);
  document.body.appendChild(bookmarkSpine);
  document.body.appendChild(pullTab);

  // Apply initial appearance
  updatePullTabAppearance();

  // Apply interactions
  const spineElement = document.getElementById(VESTA_BOOKMARK_SPINE_ID) as HTMLDivElement | null;
  const dynamicBgElement = document.getElementById(
    VESTA_DYNAMIC_BACKGROUND_ID
  ) as HTMLDivElement | null;

  if (spineElement) {
    spineElement.style.transition = "transform 0.2s ease-out, background-color 0.2s ease-out";
  }

  initializeInteractions({
    tab: pullTab,
    spine: spineElement,
    dynamicBg: dynamicBgElement,
  });
};

export const removePullTab = (): void => {
  const existingPullTab = document.getElementById(VESTA_PULL_TAB_ID);
  if (existingPullTab) {
    existingPullTab.remove();
    currentPullTabElement = null;
  }
  const existingSpine = document.getElementById(VESTA_BOOKMARK_SPINE_ID);
  if (existingSpine) {
    existingSpine.remove();
  }
  const existingDynamicBg = document.getElementById(VESTA_DYNAMIC_BACKGROUND_ID);
  if (existingDynamicBg) {
    existingDynamicBg.remove(); // Remove the dynamic background as well
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === ActionEvents.SIDE_PANEL_OPENED) {
    isPanelOpenForThisTab = true;
    updatePullTabAppearance();
    sendResponse({ status: "SIDE_PANEL_OPENED_ACK_FROM_PULL_TAB" });
  } else if (request.action === ActionEvents.SIDE_PANEL_IS_NOW_CLOSING) {
    isPanelOpenForThisTab = false;
    updatePullTabAppearance();
    sendResponse({ status: "SIDE_PANEL_CLOSING_ACK_FROM_PULL_TAB" });
  }

  if (
    request.action === ActionEvents.SIDE_PANEL_OPENED ||
    request.action === ActionEvents.SIDE_PANEL_IS_NOW_CLOSING
  ) {
    return true;
  }
});

const isOnRightmovePropertyPage = (): boolean => {
  return RIGHTMOVE_PROPERTY_PAGE_REGEX.test(window.location.href);
};
