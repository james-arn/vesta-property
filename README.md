# Vesta Property Search

## About

This is a chrome extension that has a feature-by-feature checklist that evaluates property listings for completeness or highlights missing critical information.

In doing so, it enhancees transparency and assists buyers in making more informed decisions about the biggest risk purchase of their lives.

## Setting up the project and running first time

1. Clone the repository
2. Run `npm install`
3. make .env.development and .env.production file in the root of the project containing the following
   MEASUREMENT_ID
   API_SECRET
   GA_ENDPOINT
   VESTA_PROPERTY_DATA_ENDPOINT
   USE_PREMIUM_DATA_MOCK_ON_FRONTEND
   USE_PREMIUM_DATA_MOCK_ON_BACKEND
4. Run `npm run build:dev` or `npm run build:prod` depending on which enviornment you want. Note: production strips out all console.logs
5. Open chrome and go to `chrome://extensions/`
6. Click on `Load unpacked`
7. Select the `dist` folder
8. Go to a rightmove property listing page.
9. Click the extension icon and the sidebar will open.

## Running the project ongoing

1. Run `npm run watch:dev or npm run watch:prod` -this will watch for changes and rebuild the project
2. Open chrome and go to `chrome://extensions/`
3. Click on `Update`
4. You can now see the update.

## Authentication with AWS Cognito

This extension uses AWS Cognito for secure authentication and user management. Here's how it works:

### Authentication Flow

1. **PKCE Authentication Flow**: We implement the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange) for maximum security:

   - The extension generates a random code verifier
   - A code challenge is derived from the verifier using SHA-256
   - The user is redirected to the Cognito Hosted UI with the code challenge
   - After successful authentication, Cognito returns an authorization code
   - The extension exchanges this code for ID, access, and refresh tokens

2. **Token Management**:
   - **ID Token**: Contains user identity information (email, user attributes)
   - **Access Token**: Used for API authorization
   - **Refresh Token**: Used to obtain new tokens without user re-authentication

### Token Storage and Security

We follow these security best practices for token storage:

1. **Secure Storage**: Tokens are stored in `chrome.storage.local`, which is:

   - Isolated from websites
   - Not accessible by other extensions
   - Protected by Chrome's security model

2. **Token Validation**:

   - Tokens are verified for proper JWT format
   - Expiration times are checked before tokens are used
   - Payloads are properly parsed and validated

3. **Token Refresh Mechanism**:

   - ID and access tokens expire after 1 hour
   - The refresh token is valid for 30 days
   - The extension automatically refreshes tokens when:
     - A token is within 5 minutes of expiry
     - A periodic refresh check runs (every 30 minutes)
     - An expired token is encountered but a refresh token is available

4. **Automatic Sign-Out**:
   - If token refresh fails (e.g., refresh token expired after 30 days)
   - The user is automatically signed out
   - Tokens are securely removed from storage
   - User must re-authenticate via Cognito

### Development and Testing Tools

When running in development mode, the extension includes a DevTools panel for testing authentication:

1. **Authentication Status**: View token expiry times and user information
2. **Testing Functions**:
   - Force token refresh
   - Artificially modify token expiry times
   - Simulate different auth scenarios

To use DevTools:

- Run the extension in development mode
- The panel appears at the bottom of the sidebar
- Use the provided buttons to test various auth scenarios

### Security Best Practices

- **Immutable Data Patterns**: We use immutable patterns when handling authentication data
- **PKCE Flow**: Protects against authorization code interception attacks
- **Secure Token Transport**: All token exchanges happen over HTTPS
- **Minimal Token Exposure**: Tokens are never exposed to web pages
- **Token Sanitization**: Tokens are properly validated before use
- **Error Handling**: Comprehensive error handling with Sentry integration

### Debugging Authentication

Common authentication issues can be debugged by:

1. Using the DevTools panel in development mode
2. Checking Chrome Extension background logs at `chrome://extensions/`
3. Monitoring token expiry and refresh events in the console

For production debugging:

- Check the Sentry dashboard for auth-related errors
- Use the Chrome DevTools storage inspector to verify token presence

## Architecture

The project uses the following technologies:

- **Chrome Extension Manifest V3:** For accessing the chrome API such as tabs.
- **React:** A JavaScript library for building user interfaces, used to create the extension's UI.
- **Tailwind CSS:** A utility-first CSS framework for styling the UI components.
- **React Query** for caching and background updates.
- **Shadcn:** A component library that provides pre-designed UI components to speed up development.
- **Sentry** for error handling.
- **Google Analytics** for reporting on how to improve the extension.

- **AWS Lambda, DynamoDB, API Gateway:** Not in this repo, but we have a serverless backend that is used to:
  - Handle API keys outside of client and providing crime API in free version.
  - Handle transactions securely.
  - Provide multi-device authentication and licensing
  - Enable premium features (such as enhanced data for property searches) for paid users.
  - Track and decrement user credits securely.

New developers joining the project should note:

## How Chrome Extensions Work & Debugging

Chrome extensions (Manifest V3) consist of several key components:

- **UI (App.tsx):** The React-based interface that renders the sidebar for user interaction.

  - _Debug by:_ Right-clicking on the sidebar (not the webpage) and selecting **Inspect**.

- **Background Script (background.ts):** Manages the extension lifecycle and mediates between the UI and content scripts via the Chrome API.

  - _Debug by:_ Navigating to `chrome://extensions/`, locating the extension, and checking the **Errors**.

- **Content Script (contentScript.ts):** Injected into web pages, this script interacts with the page's DOM and communicates with the extension framework.
  - _Debug by:_ Right-clicking on the webpage (not the sidebar) and selecting **Inspect**.

These components communicate using message passing, which enables complex interactivity between the UI, background, and content scripts.

## Caching Strategy

To optimize performance and avoid redundant data fetching or processing, the extension employs the following caching strategies:

- **Scraped Property Data:** TanStack Query (`useQuery`) caches the initial property data scraped from Rightmove pages. The cache key includes the property ID (`[REACT_QUERY_KEYS.PROPERTY_DATA, propertyId]`). This prevents re-scraping when switching between already visited property tabs.
- **Processed EPC Data:** Complex EPC processing (PDF OCR and image analysis) is also managed by TanStack Query. The result of processing a specific EPC URL (image or PDF) is cached using a distinct key (`['processedEpc', epcUrl]`). This avoids re-running expensive analysis on the same EPC document, even across different property listings that might link to it.
  - The query intelligently uses initial data from the scrape if confidence is high, or runs the processing function only if confidence is low, leveraging the cache for processed results.
- **Other API Data:** Hooks like `useCrimeScore`, `usePremiumStreetData`, and `useReverseGeocode` likely utilize TanStack Query internally (or could be refactored to do so) to cache results from their respective API endpoints based on appropriate keys (like coordinates or address details).

This multi-layered caching approach ensures that:

1.  Basic property data is quickly available when switching tabs.
2.  Expensive processing tasks are performed only when necessary and their results are reused.
3.  API calls are minimized by caching their responses.

## Publishing the extension to chrome web store

When publishing your extension to the Chrome Web Store, you only need to upload the production build – not your entire project. Typically, this means you should:

1. Run your production build (using `npm run build:prod`) to generate the `dist` folder.
2. Ensure that the `dist` folder contains all the necessary files (such as your `manifest.json`, built JavaScript files, HTML, icons, and any other assets required by your extension).
3. Zip up the contents of the `dist` folder (making sure that the `manifest.json` is at the root of the zip file).
4. Upload that zip file during the extension submission process.

## Frontend Data Flow

A key aspect of this extension's architecture is the separation between preparing data for UI display and preparing data for internal calculations (like the dashboard scores). This ensures maintainability and clear responsibilities.

The primary data flow is orchestrated within `src/sidepanel/App.tsx`:

1.  **Raw Data Acquisition:**

    - `App.tsx` manages the state for scraped property data (`propertyData` via `usePropertyData` context), premium API query results (`usePremiumStreetData`, `useCrimeScore`), and processed EPC data (`useProcessedEpcData`).
    - Messages from the background script update the `propertyData` state.

2.  **Data Processing Hook (`useChecklistAndDashboardData`):**

    - To keep `App.tsx` clean, the custom hook `src/hooks/useChecklistAndDashboardData.ts` takes the raw data sources as input.
    - **Checklist Generation:** Inside the hook, `src/sidepanel/propertychecklist/propertyChecklist.ts -> generatePropertyChecklist` is called. This function's primary role is to create the `PropertyDataListItem[]` array needed by the UI. It transforms raw data points into appropriate _display strings_ and determines the correct `DataStatus` based on the best available information (preferring premium data if available and valid, falling back to scraped data).
    - **Calculation Data Preparation:** The hook also prepares a specific `calculationData` object containing values needed for scoring, formatted numerically or in a specific way required by the calculation logic (e.g., `calculatedLeaseMonths: number | null`, `epcScoreForCalculation: number`). This uses helpers like `calculateRemainingLeaseTerm` and `mapEpcToScore`.
    - **Score Calculation:** The hook then calls `src/utils/scoreCalculations.ts -> calculateDashboardScores`, passing it both the `basePropertyChecklistData` (for looking up simpler values like council tax band) and the prepared `calculationData` (for complex/derived values like lease months and EPC score).
    - **Return:** The hook returns the `basePropertyChecklistData` and the final calculated `dashboardScores`.

3.  **Rendering in `App.tsx`:**
    - `App.tsx` receives the `basePropertyChecklistData` and `dashboardScores` from the hook.
    - It passes `basePropertyChecklistData` (or a filtered version) to `src/sidepanel/components/ChecklistView.tsx` for rendering the detailed checklist.
    - It passes `dashboardScores` (and potentially `basePropertyChecklistData` if needed by child components) to `src/sidepanel/components/DashboardView.tsx` for rendering the dashboard summary.

**Benefits of this Approach:**

- **Separation of Concerns:** UI display logic (`generatePropertyChecklist`) is distinct from calculation logic (`calculateDashboardScores` and the preparation in the hook).
- **Maintainability:** Changes to UI formatting are less likely to break calculations, and vice-versa.
- **Clear Data Flow:** `App.tsx` uses the hook as a clear source for processed data needed by the different views.
- **Correct Data Types:** Calculations use appropriate numeric/specific types prepared in `calculationData`, while the UI uses display strings from `PropertyDataListItem`.
