import { Container } from "./Container";
import { Brand } from "./Brand";
import { OptionsButton } from "./OptionsButton";

/** Fallback view when no stat block scrapes: points the user at a DDB monster Details page. */
export function HelpText(props: {
  setShowOptions: (show: boolean) => void;
}) {
  return (
    <Container>
      <Brand subtitle="Importer" action={<OptionsButton onClick={() => props.setShowOptions(true)} />} />
      <p className="text-slate-300">
        Could not read a monster stat block from this page. Open a monster's
        <strong className="text-slate-100"> Details</strong> page on D&amp;D Beyond,
        then click the extension again to get its OpenFray Creature JSON.
      </p>
      <Link url="https://www.dndbeyond.com/monsters">D&amp;D Beyond: Monsters</Link>
    </Container>
  );
}

/** An anchor that opens its URL in the active tab (a plain href would target the popup). */
function Link(props: { url: string; children: any }) {
  return (
    <a
      className="font-medium text-indigo-400 hover:text-indigo-300"
      href="#"
      onClick={() =>
        browser.tabs.update({
          active: true,
          url: props.url,
        })
      }
    >
      {props.children}
    </a>
  );
}
