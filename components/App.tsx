import { useEffect, useState } from "react";
import type { ImportedItem } from "@/utils/imported_item";
import { statBlockToCreature } from "@/utils/statBlockToCreature";
import type { Creature } from "@/utils/openfray/schema";
import { HelpText } from "./help_text";
import { Importer } from "./Importer";
import { OptionsEditor } from "./optionseditor";

/** Popup root: requests the active tab's scraped stat block, then shows Options, Help, or Importer. */
function App() {
  const [creature, setCreature] = useState<Creature>();
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Promise style (not callbacks) so it works on both Chrome and Firefox — WXT
    // resolves `browser` to Firefox's native promise-based API, which ignores callbacks.
    (async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTabId = tabs[0]?.id;
      if (!activeTabId) return;
      const item = (await browser.tabs.sendMessage(activeTabId, {
        action: ScrapeStatBlockAction,
      })) as ImportedItem | null;
      if (cancelled) return;
      // Monsters only: a scraped stat block converts; spell pages don't.
      setCreature(item && item.type === "statblock" ? statBlockToCreature(item.data) : undefined);
    })().catch(() => {
      if (!cancelled) setCreature(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [showOptions]);

  if (showOptions) {
    return <OptionsEditor setShowOptions={setShowOptions} />;
  }

  if (!creature) {
    return <HelpText setShowOptions={setShowOptions} />;
  }

  return <Importer creature={creature} setShowOptions={setShowOptions} />;
}

export default App;
