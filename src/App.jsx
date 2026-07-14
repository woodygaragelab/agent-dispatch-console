import React, { useState, useRef, useEffect } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, ChevronDown, Zap, Play, RotateCw, ExternalLink } from "lucide-react";

const AGENTS = [
  { id: "scout", name: "受領", role: "情報収集・調査", example: "取引先から届いた見積書・請求書PDFをメールから取得し、案件フォルダに格納する" },
  { id: "archivist", name: "分類", role: "文書整理・分類", example: "receiptフォルダの新しい領収書画像を勘定科目ごとにリネーム・分類する" },
  { id: "courier", name: "会計", role: "外部連携・送信", example: "領収書リストから仕訳データに変換する" },
  { id: "auditor", name: "チェック", role: "検証・照合", example: "7月分の仕訳データの科目コードをマスタと照合する" },
];

const CLIENTS = [
  { id: "jkl", short: "JKL", full: "JAKALULU" },
  { id: "jlr", short: "JLR", full: "JLAB-RPA" },
  { id: "max", short: "MAX", full: "MaximoPJ" },
  { id: "amr", short: "AMR", full: "AMORPHOUS" },
  { id: "ikk", short: "IKK", full: "Ikkoh" },
];

const STATUS_STYLES = {
  queued: { label: "待機中", color: "#8A8F98", bg: "rgba(138,143,152,0.12)", icon: Clock },
  running: { label: "実行中", color: "#E8A33D", bg: "rgba(232,163,61,0.14)", icon: Loader2 },
  done: { label: "完了", color: "#5FB88A", bg: "rgba(95,184,138,0.14)", icon: CheckCircle2 },
  error: { label: "エラー", color: "#D4634A", bg: "rgba(212,99,74,0.14)", icon: XCircle },
};

const STATUS_CYCLE = ["done", "running", "error", "queued"];

const pad2 = (n) => String(n).padStart(2, "0");
const formatNow = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const INPUT_FOLDER_URL = "https://drive.google.com/drive/folders/12RgXCZ9MndybR17FcMn7MGDA9J9lP21w?usp=drive_link";
const OUTPUT_FOLDER_URL = "https://drive.google.com/drive/folders/1VhpfUW2Dr202xmYEEPUjhQlwWQS94iqh?usp=drive_link";

const folderPair = () => ({
  inputFolder: "IKK/receipt",
  outputFolder: "IKK/renamed",
  inputFolderUrl: INPUT_FOLDER_URL,
  outputFolderUrl: OUTPUT_FOLDER_URL,
});

const INITIAL_TICKETS = CLIENTS.flatMap((c, ci) =>
  AGENTS.map((a, ai) => {
    const status = STATUS_CYCLE[(ci + ai) % STATUS_CYCLE.length];
    const startH = 9 + ((ci + ai) % 6);
    const startM = (ai * 15) % 60;
    const startTime = status === "queued" ? null : `${pad2(startH)}:${pad2(startM)}`;
    const endTime =
      status === "done" || status === "error"
        ? `${pad2(startH + (ai % 2 === 0 ? 0 : 1))}:${pad2((startM + 20) % 60)}`
        : null;
    return {
      id: String(150 + ci * AGENTS.length + ai).padStart(4, "0"),
      agentId: a.id,
      agentName: a.name,
      agentRole: a.role,
      clientId: c.id,
      instruction: a.example,
      status,
      startTime,
      endTime,
      ...folderPair(c, a),
      fresh: false,
    };
  })
);

function useTicketClock(ticket, onAdvance) {
  useEffect(() => {
    if (ticket.status !== "running") return;
    const t = setTimeout(() => onAdvance(ticket.id), 2200 + Math.random() * 1600);
    return () => clearTimeout(t);
  }, [ticket.status, ticket.id]);
}

function Ticket({ ticket, onAdvance, onStart, expanded, onToggle }) {
  useTicketClock(ticket, onAdvance);
  const s = STATUS_STYLES[ticket.status];
  const Icon = s.icon;
  return (
    <div
      onClick={() => onToggle(ticket.id)}
      className="group cursor-pointer border-b border-[#3A404A] transition-colors hover:bg-[#2C3039]"
      style={{ animation: ticket.fresh ? "dropIn 420ms cubic-bezier(.2,.8,.2,1)" : "none" }}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: s.bg, color: s.color }}
        >
          <Icon size={17} className={ticket.status === "running" ? "animate-spin" : ""} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold text-[#E4E6EB]">{ticket.agentName}</span>
            <span className="font-mono text-[11px] text-[#5C6270]">#{ticket.id}</span>
            {ticket.clientId && (
              <span className="rounded bg-[#3A404A] px-1.5 py-0.5 font-mono text-[10px] text-[#9AA0AC]">
                {CLIENTS.find((c) => c.id === ticket.clientId)?.short}
              </span>
            )}
          </div>
          <p className="truncate text-[12.5px] text-[#9AA0AC]">{ticket.instruction}</p>
        </div>
        <span
          className="shrink-0 rounded px-2 py-0.5 font-mono text-[10.5px] tracking-wide"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 text-[#5C6270] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </div>
      {expanded && (
        <div className="mx-5 mb-3.5 rounded-md border border-[#3A404A] bg-[#1C2026] px-4 py-3.5 text-[12px]">
          {ticket.status === "queued" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(ticket.id);
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#3A4048] bg-transparent px-4 py-3 text-[15px] font-semibold text-[#C8CCD4] transition-colors hover:bg-[#1F242C]"
            >
              <Play size={18} />
              開始する
            </button>
          )}
          {(ticket.status === "done" || ticket.status === "error") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(ticket.id);
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#3A4048] bg-transparent px-4 py-3 text-[15px] font-semibold text-[#C8CCD4] transition-colors hover:bg-[#1F242C]"
            >
              <RotateCw size={18} />
              再実行
            </button>
          )}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>指示内容</span>
              <span className="text-[#C8CCD4]">{ticket.instruction}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>ステータス</span>
              <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px]" style={{ background: s.bg, color: s.color }}>
                {s.label}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>開始時刻</span>
              <span className="font-mono text-[#C8CCD4]">{ticket.startTime || "—"}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>完了時刻</span>
              <span className="font-mono text-[#C8CCD4]">{ticket.endTime || "—"}</span>
            </div>

            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>入力フォルダ</span>
              <a
                href={ticket.inputFolderUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 break-all font-mono text-[#7FA8D9] underline decoration-[#7FA8D9]/40 underline-offset-2 hover:text-[#9CBCE3]"
              >
                {ticket.inputFolder}
                <ExternalLink size={11} className="shrink-0" />
              </a>
            </div>

            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#5C6270]" style={{ width: "84px" }}>出力フォルダ</span>
              <a
                href={ticket.outputFolderUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 break-all font-mono text-[#7FA8D9] underline decoration-[#7FA8D9]/40 underline-offset-2 hover:text-[#9CBCE3]"
              >
                {ticket.outputFolder}
                <ExternalLink size={11} className="shrink-0" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentDispatchConsole() {
  const [clientFilter, setClientFilter] = useState(CLIENTS[0].id);
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [expandedId, setExpandedId] = useState(null);

  const advance = (id) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: Math.random() > 0.15 ? "done" : "error", endTime: formatNow() } : t
      )
    );
  };

  const start = (id) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "running", startTime: formatNow(), endTime: null } : t))
    );
  };

  const visibleTickets = tickets.filter((t) => t.clientId === clientFilter);

  return (
    <div className="min-h-screen w-full bg-[#242830] text-[#E4E6EB]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes dropIn {
          0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        textarea::placeholder { color: #5C6270; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #3A404A; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#3A404A] px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E8A33D]/15">
            <Zap size={16} className="text-[#E8A33D]" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-[15px] font-semibold tracking-tight">
              DISPATCH
            </h1>
            <p className="text-[11px] text-[#5C6270]">エージェント指示コンソール</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#5C6270]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5FB88A]" />
          稼働中のエージェント {AGENTS.length}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-8">
        {/* Queue */}
        <div className="rounded-xl border border-[#3A404A] bg-[#282C34]">
          <div className="border-b border-[#3A404A] px-5 py-3">
            <span className="mb-2 block text-[10.5px] font-medium tracking-wide text-[#5C6270]">クライアント</span>
            <div className="flex flex-wrap gap-1.5">
              {CLIENTS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setClientFilter(c.id)}
                  className="rounded-full border px-2.5 py-1 font-mono transition-all"
                  style={{
                    borderColor: clientFilter === c.id ? "#E8A33D" : "#3A404A",
                    background: clientFilter === c.id ? "rgba(232,163,61,0.12)" : "transparent",
                    color: clientFilter === c.id ? "#E8A33D" : "#8A8F98",
                    fontSize: clientFilter === c.id ? "15px" : "11px",
                    fontWeight: clientFilter === c.id ? 700 : 400,
                    padding: clientFilter === c.id ? "6px 14px" : "4px 10px",
                  }}
                >
                  {`(${c.short})${c.full}`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[#3A404A] px-5 py-3.5">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-[13px] font-semibold">
              エージェントへの指示
            </span>
            <span className="font-mono text-[11px] text-[#5C6270]">{visibleTickets.length} 件</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {visibleTickets.map((t) => (
              <Ticket
                key={t.id}
                ticket={t}
                onAdvance={advance}
                onStart={start}
                expanded={expandedId === t.id}
                onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              />
            ))}
            {visibleTickets.length === 0 && (
              <div className="px-5 py-10 text-center text-[12px] text-[#5C6270]">このクライアントの指示はまだありません</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
