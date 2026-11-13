import { useRef, useState } from "react";
import { parseTyped } from "../lib/typedTime";
import { DNF, fmt, type Penalty } from "../lib/stats";

// The timer page's entry box in typing mode: type a time, press Enter to add it.
export function TypedEntry({ onAdd, isTouch }: { onAdd: (t: number, pen: Penalty) => void; isTouch: boolean }) {
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const read = parseTyped(text);
  const preview = !text.trim() ? null
    : !read ? "Can't read that"
    : read.pen === DNF ? (read.t ? `DNF (${fmt(read.t)})` : "DNF")
    : read.pen === 2 ? `${fmt(read.t)} +2 = ${fmt(read.t + 2000)}`
    : fmt(read.t);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!read) { setBad(!!text.trim()); return; }
    onAdd(read.t, read.pen);
    setText("");
    setBad(false);
    input.current?.focus();
  };

  return (
    <form className="typed-entry" onSubmit={submit}>
      <div className="typed-row">
        <input ref={input} className={bad && !read ? "bad" : ""} value={text} autoFocus={!isTouch}
          onChange={e => { setText(e.target.value); setBad(false); }}
          inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
          placeholder="Time, e.g. 12.34" aria-label="Type a time" aria-describedby="typed-help" />
        <button type="submit" className="on" disabled={!read}>Add</button>
      </div>
      <div id="typed-help" className="hint" aria-live="polite">
        {preview ?? <>12.34 · 1:02.34 · 1234 · add <kbd>+</kbd> for +2 · DNF</>}
      </div>
    </form>
  );
}
