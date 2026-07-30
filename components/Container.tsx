/** The popup's dark shell: a full-height column under the indigo top border. */
export function Container(props: { children: any }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 border-t-4 border-indigo-600 bg-slate-950 p-4 text-sm text-slate-100">
      {props.children}
    </div>
  );
}
