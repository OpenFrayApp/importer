import { useState } from "react";
import type { Creature } from "@/utils/openfray/schema";
import { Container } from "./Container";
import { Brand } from "./Brand";
import { OptionsButton } from "./OptionsButton";

/** The import view: creature name, scrollable Creature JSON, and Copy/Download buttons. */
export function Importer(props: {
  creature: Creature;
  setShowOptions: (show: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(props.creature, null, 2);

  /** Copy the JSON to the clipboard and flash the button label to "Copied!". */
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /** Save the JSON as "<slug>.json" (the id minus its namespace) via a temporary anchor. */
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.creature.id.replace(/^.*:/, "") || "creature"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container>
      <Brand subtitle="Importer" action={<OptionsButton onClick={() => props.setShowOptions(true)} />} />
      <div className="flex min-h-0 flex-1 flex-col">
        {/* shrink-0 on the name and buttons, flex-1 (basis 0) on the JSON: with the
            default auto basis a long stat block sizes the <pre> to its content and
            squeezes its siblings — the name was clipped, or gone entirely. */}
        <h3 className="shrink-0 truncate font-semibold text-slate-200">{props.creature.name}</h3>
        <pre className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-900 p-2 font-mono text-xs text-slate-300">
          {json}
        </pre>
        <div className="flex shrink-0 flex-row gap-2 pt-3">
          <button
            onClick={copy}
            className="flex-grow rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button
            onClick={download}
            className="flex-grow rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Download .json
          </button>
        </div>
      </div>
    </Container>
  );
}
