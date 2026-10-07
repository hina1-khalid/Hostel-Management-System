import React, { useEffect, useRef, useState } from "react";
import api, { errMsg } from "../api/axios";

const suggestions = ["What fees do I have due?", "Today's mess menu?", "What are the hostel rules?"];

const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I'm your hostel assistant. Ask me about fees, your room, the mess menu, complaints or hostel rules." }]);
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView?.({ behavior: "smooth" }); }, [msgs, open]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const history = msgs.slice(1);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await api.post("/chatbot", { message, history });
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: errMsg(e, "Sorry, I couldn't answer that right now.") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="print:hidden fixed bottom-24 right-5 z-40 w-96 max-w-[calc(100vw-2.5rem)] h-[28rem] bg-white border border-slate-200 rounded-lg shadow-2xl flex flex-col" role="dialog" aria-label="Hostel assistant">
          <div className="bg-ink text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <span className="font-display">Hostel Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-white" : "bg-white border border-slate-200 text-ink"}`}>{m.content}</div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="text-xs border border-gold text-gold-dark rounded-full px-3 py-1 hover:bg-gold/10">{s}</button>)}
              </div>
            )}
            {busy && <p className="text-xs text-muted">Typing…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-200 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" aria-label="Message" className="input !py-2" maxLength={500} />
            <button type="submit" disabled={busy || !input.trim()} className="btn btn-gold">Send</button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Open hostel assistant" className="print:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-gold text-ink shadow-lg hover:bg-gold-light flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.3A8 8 0 1121 12z" /></svg>
      </button>
    </>
  );
};
export default ChatbotWidget;
