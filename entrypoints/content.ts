import { extractStatBlock } from "@/utils/extractstatblock";
import { ScrapeStatBlockAction } from "@/utils/actions";
import { Options, initializeOptionsFromStoredValues } from "@/utils/options";
import { storage } from "wxt/storage";

export default defineContentScript({
  matches: ["*://*.dndbeyond.com/*"],
  main() {
    /** Reply to a scrape request with the page's stat block, or null; true holds sendResponse open. */
    function onRequest(
      request: any,
      _sender: any,
      sendResponse: (response: any) => void
    ) {
      if (request.action == ScrapeStatBlockAction) {
        storage.getItems(Object.values(Options)).then((optionsFromStorage) => {
          const options = initializeOptionsFromStoredValues(optionsFromStorage);
          // Both the 2014 and 2024 monster stat-block layouts; extractStatBlock
          // picks the right one. Character sheets and spells are out of scope.
          if (
            document.getElementsByClassName("mon-stat-block").length > 0 ||
            document.getElementsByClassName("mon-stat-block-2024").length > 0
          ) {
            return sendResponse({
              type: "statblock",
              data: extractStatBlock(options),
            });
          }
          sendResponse(null);
        });
      }
      return true;
    }

    browser.runtime.onMessage.addListener(onRequest);
  },
});
