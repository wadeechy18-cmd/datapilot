"use client";

import { useState, type KeyboardEvent } from "react";

import { apiFetch } from "@/lib/api";
import { selectionToRangeRef, type SelectionRange } from "@/lib/range";
import type { AISummaryRequest, AISummaryResponse, ChatMessage, ChatRequest, ChatResponse } from "@/lib/types";

type AITabProps = {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onApplied: (newFileId: string) => void;
};

export function AITab({ fileId, activeSheet, selection, onApplied }: AITabProps) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizedSheet, setSummarizedSheet] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const request: AISummaryRequest = { sheet_name: activeSheet };
      const response = await apiFetch<AISummaryResponse>(`/workbook/${fileId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      setSummary(response.summary);
      setSummarizedSheet(response.sheet_name);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || isChatting) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setChatInput("");
    setChatError(null);
    setIsChatting(true);

    try {
      const request: ChatRequest = {
        sheet_name: activeSheet,
        selection: selection.kind === "all" ? null : selectionToRangeRef(selection),
        messages: nextMessages,
      };
      const response = await apiFetch<ChatResponse>(`/workbook/${fileId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      setMessages([...nextMessages, { role: "assistant", content: response.reply }]);
      if (response.new_file_id) {
        onApplied(response.new_file_id);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsChatting(false);
    }
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChatMessage();
    }
  };

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        AI features only ever see column-level statistics (types, null/unique counts, min/max/mean) — never your
        actual cell data.
      </p>

      <div className="mt-4">
        <button
          type="button"
          disabled={isSummarizing}
          onClick={handleSummarize}
          className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {isSummarizing ? "Summarizing..." : "Summarize this sheet"}
        </button>
      </div>

      {summaryError ? <p className="mt-3 text-sm text-red-600">{summaryError}</p> : null}

      {summary ? (
        <div className="mt-3 rounded border border-excel-gridline bg-neutral-50 p-4 text-sm text-neutral-800">
          <p className="font-medium text-neutral-900">Summary of {summarizedSheet}</p>
          <p className="mt-2 whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}

      <div className="mt-6 border-t border-excel-gridline pt-4">
        <p className="text-sm font-medium text-neutral-700">Chat</p>
        <p className="mt-1 text-sm text-neutral-500">
          Ask questions about sheet <span className="font-medium text-neutral-800">{activeSheet}</span>, or ask for
          an action (e.g. &quot;bold the header&quot;, &quot;sort by column B&quot;) — the AI proposes it, and it only
          runs through the same engines the ribbon uses, never edits the file directly. Free-tier Gemini has rate
          limits, so keep an eye out for a quota error if you send a lot of messages quickly.
        </p>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded border border-excel-gridline bg-neutral-50 p-3">
          {messages.length === 0 ? (
            <p className="text-sm italic text-neutral-400">No messages yet.</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded bg-excel-green px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[85%] rounded bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm"
                }
              >
                {message.content}
              </div>
            ))
          )}
          {isChatting ? <p className="text-sm italic text-neutral-400">Thinking…</p> : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            disabled={isChatting}
            placeholder='e.g. "which product sold the most?" or "sort by column B descending"'
            className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
          <button
            type="button"
            disabled={isChatting || !chatInput.trim()}
            onClick={sendChatMessage}
            className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            Send
          </button>
        </div>

        {chatError ? <p className="mt-2 text-sm text-red-600">{chatError}</p> : null}
      </div>
    </div>
  );
}
