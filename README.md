# Vesta property search

## About

This is a chrome extension that has a feature-by-feature checklist that evaluates property listings for completeness or highlights missing critical information.

In doing so, it enhancees transparency and assists buyers in making more informed decisions about the biggest risk purchase of their lives.

## Setting up the project and running first time

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Open chrome and go to `chrome://extensions/`
5. Click on `Load unpacked`
6. Select the `dist` folder
7. Go to a rightmove property listing page.
8. Click the extension icon and the sidebar will open.

## Running the project ongoing

1. Run `npm run watch` -this will watch for changes and rebuild the project
2. Open chrome and go to `chrome://extensions/`
3. Click on `Update`
4. You can now see the update.

## Architecture

The project uses the following technologies:

- **React:** A JavaScript library for building user interfaces, used to create the extension's UI.
- **Tailwind CSS:** A utility-first CSS framework for styling the UI components.
- **Shadcn:** A component library that provides pre-designed UI components to speed up development.

This architecture allows for a modular and maintainable codebase, making it easier to develop and extend the extension's functionality.

## How Chrome Extensions Work

Chrome extensions are composed of different components that work together to provide functionality. In this project, the main components are:

- **UI (App.tsx):** This is the user interface of the extension, built using React. It is responsible for rendering the sidebar that users interact with when they click the extension icon.

- **Background Script (background.ts):** This script runs in the background and manages the extension's lifecycle. Here, we access the chrome API such as tabs. It can listen for events, manage state, and communicate with other parts of the extension. Think of it as the middleman between the UI and the content script.

- **Content Script (contentScript.ts):** This script is injected into web pages and can interact with the page's DOM. It acts as a bridge between the web page and the extension, allowing the extension to read and modify the content of the page.

These components communicate with each other using message passing, allowing the extension to perform complex tasks by coordinating actions between the UI, background script, and content script.
