import { test } from "node:test";
import assert from "node:assert/strict";
import { Options, OptionDefaults, initializeOptionsFromStoredValues } from "../utils/options.ts";

/** A stored-values entry the way wxt's storage.getItems returns them. */
function stored(key: Options, value: string) {
  return { key, value };
}

test("every option defaults to on", () => {
  assert.deepEqual(OptionDefaults, {
    [Options.IncludePageNumberWithSource]: "on",
    [Options.IncludeDescription]: "on",
    [Options.IncludeLink]: "on",
  });
});

test("no stored values leaves the defaults", () => {
  assert.deepEqual(initializeOptionsFromStoredValues([]), OptionDefaults);
  assert.deepEqual(initializeOptionsFromStoredValues(undefined as any), OptionDefaults);
});

test("stored keys that are not options are ignored", () => {
  const options = initializeOptionsFromStoredValues([
    { key: "sync:not-an-option", value: "off" },
  ]);
  assert.equal(options[Options.IncludeLink], "on");
  assert.equal(options[Options.IncludeDescription], "on");
  assert.equal(options[Options.IncludePageNumberWithSource], "on");
});

test("stored values override their option and leave the rest", () => {
  // The function writes into the shared OptionDefaults object, so restore it
  // afterwards for any test that runs later.
  try {
    const options = initializeOptionsFromStoredValues([
      stored(Options.IncludeLink, "off"),
    ]);
    assert.equal(options[Options.IncludeLink], "off");
    assert.equal(options[Options.IncludeDescription], "on");
    assert.equal(options[Options.IncludePageNumberWithSource], "on");

    const allOff = initializeOptionsFromStoredValues([
      stored(Options.IncludePageNumberWithSource, "off"),
      stored(Options.IncludeDescription, "off"),
      stored(Options.IncludeLink, "off"),
    ]);
    assert.equal(allOff[Options.IncludePageNumberWithSource], "off");
    assert.equal(allOff[Options.IncludeDescription], "off");
    assert.equal(allOff[Options.IncludeLink], "off");
  } finally {
    for (const option of Object.values(Options)) OptionDefaults[option] = "on";
  }
});
