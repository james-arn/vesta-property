
//contentScript.ts is injected into the web page and interacts with the DOM to scrape data.
function extractPropertyData() {
  const priceElement = Array.from(document.querySelectorAll('strong')).find(el => el.textContent?.includes('€'));
  const locationElement = Array.from(document.querySelectorAll('h1')).find(el => el.textContent?.includes('flat for sale'));
  const bedroomsElement = Array.from(document.querySelectorAll('li')).find(el => el.textContent?.includes('T3'));
  const bathroomsElement = Array.from(document.querySelectorAll('li')).find(el => el.textContent?.includes('bathroom'));
  const imagesElement = Array.from(document.querySelectorAll('p')).find(el => el.textContent?.includes('photos'));
  return {
    price: priceElement?.textContent?.trim() || null,
    location: locationElement?.textContent?.trim() || null,
    bedrooms: bedroomsElement?.textContent?.trim() || null,
    bathrooms: bathroomsElement?.textContent?.trim() || null,
    images: imagesElement?.textContent?.trim() || null,
  };
};

console.log('contentScript.js', window.location.href);

// // Check if the current page URL matches the desired pattern
// if (window.location.href.includes('idealista.pt') && window.location.href.includes('imovel')) {
//   // Extract data and send it to the background script
//   const propertyData = extractPropertyData();
//   chrome.runtime.sendMessage({ action: ActionEvents.UPDATE_PROPERTY_DATA, data: propertyData });
// } else {
//   // Send a message to the background script to display a warning
//   chrome.runtime.sendMessage({
//     action: ActionEvents.SHOW_WARNING,
//     message: 'Please open a property page on idealista.pt/en/imovel.',
//   });
// }
