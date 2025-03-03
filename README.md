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
   VESTA_AWS_ENDPOINT
   USE_PREMIUM_DATA_MOCK
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

## Architecture

The project uses the following technologies:

- **Chrome Extension Manifest V3:** For accessing the chrome API such as tabs.
- **React:** A JavaScript library for building user interfaces, used to create the extension's UI.
- **Tailwind CSS:** A utility-first CSS framework for styling the UI components.
- **React Query** for caching and background updates.
- **Shadcn:** A component library that provides pre-designed UI components to speed up development.
- **Sentry** for error handling.
- **Google Analytics** for reporting on how to improve the extension.
- **ExtensionPay** to manage payments, authentication, and subscription-based premium features. ExtensionPay's integration with Stripe allows us to:

  - Handle transactions securely.
  - Provide multi-device authentication and licensing without the need for building an in-house system.
  - Enable premium features (such as enhanced data for property searches) for paid users.

- **AWS Lambda, DynamoDB, API Gateway:** Not in this repo, but we have a serverless backend that is used to:
  - Handle API keys outside of client and providing crime API.
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

## Publishing the extension to chrome web store

When publishing your extension to the Chrome Web Store, you only need to upload the production build – not your entire project. Typically, this means you should:

1. Run your production build (using `npm run build:prod`) to generate the `dist` folder.
2. Ensure that the `dist` folder contains all the necessary files (such as your `manifest.json`, built JavaScript files, HTML, icons, and any other assets required by your extension).
3. Zip up the contents of the `dist` folder (making sure that the `manifest.json` is at the root of the zip file).
4. Upload that zip file during the extension submission process.
