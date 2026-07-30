import { Options } from "@/utils/options";
import { ChangeEvent } from "react";
import { storage } from "wxt/storage";
import { Brand } from "./Brand";

/** The options view: one checkbox per import option, plus a Done button to return. */
export function OptionsEditor(props: {
  setShowOptions: (show: boolean) => void;
}) {
  return (
    <Container>
      <Brand subtitle="Options" />
      <section className="flex flex-col gap-2">
        <Checkbox
          optionName={Options.IncludeDescription}
          label="Include description"
        />
        <Checkbox
          optionName={Options.IncludePageNumberWithSource}
          label="Include page number in source"
        />
        <Checkbox
          optionName={Options.IncludeLink}
          label="Include link to source in description"
          hint="Includes a link back to the source URL at the end of the description block."
        />
        <button
          type="button"
          className="mt-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={() => props.setShowOptions(false)}
        >
          Done
        </button>
      </section>
    </Container>
  );
}

/** A labelled option toggle: hydrates from extension storage and writes "on"/"off" on change. */
const Checkbox = (props: {
  optionName: Options;
  label: string;
  hint?: string;
}) => {
  const [option, setOption] = useState<string>("off");
  useEffect(() => {
    storage.getItem(props.optionName).then((value) => {
      if (typeof value === "string") {
        setOption(value);
      }
    });
  }, [props.optionName]);

  return (
    <label className="flex items-center gap-2 text-slate-200" title={props.hint}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-indigo-500"
        checked={option === "on"}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.checked ? "on" : "off";
          storage.setItem(props.optionName, newValue);
          setOption(newValue);
        }}
      />
      {props.label}
    </label>
  );
};
