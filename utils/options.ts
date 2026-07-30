export enum Options {
  IncludePageNumberWithSource = "sync:include-page-number-with-source",
  IncludeDescription = "sync:include-description",
  IncludeLink = "sync:include-link",
}

export type AllOptions = Record<Options, string>;

export const OptionDefaults: AllOptions = {
  [Options.IncludePageNumberWithSource]: "on",
  [Options.IncludeDescription]: "on",
  [Options.IncludeLink]: "on",
};

/** Fill the option set from stored extension values, keeping the defaults for unset keys. */
export function initializeOptionsFromStoredValues(
  values: {
    key:
      | `local:${string}`
      | `session:${string}`
      | `sync:${string}`
      | `managed:${string}`;
    value: any;
  }[]
) {
  // A copy — writing into OptionDefaults itself would let a stored "off" pollute
  // the defaults for every later caller.
  const options = { ...OptionDefaults };
  if (values) {
    for (const key in options) {
      const storedOption = values.find((v) => v.key === key);
      if (storedOption) {
        options[key as Options] = storedOption.value;
      }
    }
  }
  return options;
}
