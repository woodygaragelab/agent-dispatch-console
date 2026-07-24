import React, { useState, useEffect } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, ChevronDown, Zap, Play, RotateCw, ExternalLink } from "lucide-react";

// receipt-ocr-filelist (AgentCore) 経由で実処理する対象エージェント。
// 他のエージェントは未接続のため、従来どおりのモック動作のままにしておく。
const LIVE_AGENT_IDS = ["archivist"];
const API_BASE = "https://ljaulscga3.execute-api.ap-northeast-1.amazonaws.com";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

const AGENTS = [
  { id: "scout", name: "受領", role: "情報収集・調査", instruction: "取引先から届いた見積書・請求書PDFをメールから取得し、案件フォルダに格納する" },
  { id: "archivist", name: "分類", role: "文書整理・分類", instruction: "receiptフォルダの新しい領収書画像を勘定科目ごとにリネーム・分類する" },
  { id: "courier", name: "会計", role: "外部連携・送信", instruction: "領収書リストから仕訳データに変換する" },
  { id: "auditor", name: "チェック", role: "検証・照合", instruction: "仕訳データの科目コードをマスタと照合する" },
  { id: "pinger", name: "疎通確認", role: "接続確認・監視", instruction: "会計システムAPIへの接続状態を確認し、応答時間を記録する" },
];

const STATUS_STYLES = {
  queued: { label: "待機中", color: "#6B7280", bg: "rgba(138,143,152,0.12)", icon: Clock },
  running: { label: "実行中", color: "#E8A33D", bg: "rgba(232,163,61,0.14)", icon: Loader2 },
  done: { label: "完了", color: "#5FB88A", bg: "rgba(95,184,138,0.14)", icon: CheckCircle2 },
  error: { label: "エラー", color: "#D4634A", bg: "rgba(212,99,74,0.14)", icon: XCircle },
};

const pad2 = (n) => String(n).padStart(2, "0");
const formatNow = () => {
  const d = new Date();
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// 関与先(案件)とDriveフォルダIDのマスタは、DynamoDB (receipt-agent-clients
// テーブル) を GET /clients で公開しているAPIから取得する。同じAPIを
// receipt-ocr-filelistスキルのSKILL.mdも参照しており、マスタをこのファイルに
// 直書きしない(1か所で管理するため。詳細は receipt-agent-clients-api/ 参照)。
const CLIENTS_ENDPOINT = `${API_BASE}/clients`;

const driveUrl = (folderId) =>
  folderId ? `https://drive.google.com/drive/folders/${folderId}?usp=drive_link` : null;

const buildTickets = (clients) =>
  clients.flatMap((c, ci) =>
    AGENTS.map((a, ai) => ({
      id: String(150 + ci * AGENTS.length + ai).padStart(4, "0"),
      agentId: a.id,
      agentName: a.name,
      agentRole: a.role,
      clientId: c.code.toLowerCase(),
      clientShort: c.code,
      clientFull: c.fullName,
      instruction: a.instruction,
      status: "queued",
      startTime: null,
      endTime: null,
      inputFolder: "/receipt",
      outputFolder: "/renamed",
      inputFolderUrl: driveUrl(c.receiptFolderId),
      outputFolderUrl: driveUrl(c.renamedFolderId),
      fresh: false,
    }))
  );

function Ticket({ ticket, onStart, expanded, onToggle }) {
  const s = STATUS_STYLES[ticket.status];
  const Icon = s.icon;
  return (
    <div
      onClick={() => onToggle(ticket.id)}
      className="group cursor-pointer border-b border-[#E2E4E9] transition-colors hover:bg-[#F5F6F8]"
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
            <span className="text-[32px] font-bold text-[#1F2430]">{ticket.agentName}</span>
            <span className="font-mono text-[11px] text-[#8A93A3]">#{ticket.id}</span>
            {ticket.clientShort && (
              <span className="rounded bg-[#E2E4E9] px-1.5 py-0.5 font-mono text-[10px] text-[#6B7280]">
                {ticket.clientShort}
              </span>
            )}
          </div>
          <p className="truncate text-[12.5px] text-[#6B7280]">{ticket.instruction}</p>
        </div>
        <span
          className="shrink-0 rounded px-2 py-0.5 font-mono text-[10.5px] tracking-wide"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 text-[#8A93A3] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </div>
      {expanded && (
        <div className="mx-5 mb-3.5 rounded-md border border-[#E2E4E9] bg-[#F8F9FB] px-4 py-3.5 text-[12px]">
          {ticket.status === "queued" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(ticket.id);
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D8DBE1] bg-transparent px-4 py-3 text-[15px] font-semibold text-[#374151] transition-colors hover:bg-[#F0F1F4]"
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
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D8DBE1] bg-transparent px-4 py-3 text-[15px] font-semibold text-[#374151] transition-colors hover:bg-[#F0F1F4]"
            >
              <RotateCw size={18} />
              再実行
            </button>
          )}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>指示内容</span>
              <span className="text-[#374151]">{ticket.instruction}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>ステータス</span>
              <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px]" style={{ background: s.bg, color: s.color }}>
                {s.label}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>開始時刻</span>
              <span className="font-mono text-[#374151]">{ticket.startTime || "—"}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>完了時刻</span>
              <span className="font-mono text-[#374151]">{ticket.endTime || "—"}</span>
            </div>

            {ticket.result && (
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>実行結果</span>
                <span className="whitespace-pre-wrap break-words text-[#374151]">{ticket.result}</span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>入力フォルダ</span>
              {ticket.inputFolderUrl ? (
                <a
                  href={ticket.inputFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 break-all font-mono text-[#2563EB] underline decoration-[#2563EB]/40 underline-offset-2 hover:text-[#1D4ED8]"
                >
                  {ticket.inputFolder}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              ) : (
                <span className="font-mono text-[#8A93A3]">未設定</span>
              )}
            </div>

            <div className="flex items-start gap-3">
              <span className="shrink-0 text-[#8A93A3]" style={{ width: "84px" }}>出力フォルダ</span>
              {ticket.outputFolderUrl ? (
                <a
                  href={ticket.outputFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 break-all font-mono text-[#2563EB] underline decoration-[#2563EB]/40 underline-offset-2 hover:text-[#1D4ED8]"
                >
                  {ticket.outputFolder}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              ) : (
                <span className="font-mono text-[#8A93A3]">未設定</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentDispatchConsole() {
  const [clients, setClients] = useState([]);
  const [clientsStatus, setClientsStatus] = useState("loading"); // loading | ready | error
  const [clientFilter, setClientFilter] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(CLIENTS_ENDPOINT)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setClients(data);
        setTickets(buildTickets(data));
        setClientFilter((prev) => prev ?? data[0]?.code.toLowerCase() ?? null);
        setClientsStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setClientsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // LIVE_AGENT_IDS に含まれるエージェントのみ、実際にAgentCoreへ処理を依頼する。
  // それ以外は従来どおりのモック挙動(ランダムに完了/エラーへ遷移)のまま。
  const pollJob = (id, jobId, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "error", result: "応答がタイムアウトしました", endTime: formatNow() } : t
        )
      );
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/${jobId}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const job = await res.json();

        if (job.status === "processing") {
          pollJob(id, jobId, attempt + 1);
          return;
        }
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: job.status === "completed" ? "done" : "error",
                  result: job.result || job.error || "",
                  endTime: formatNow(),
                }
              : t
          )
        );
      } catch (err) {
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "error", result: String(err), endTime: formatNow() } : t))
        );
      }
    }, POLL_INTERVAL_MS);
  };

  const startLive = async (id, ticket) => {
    const prompt = `${ticket.clientShort}の領収書を整理して`;
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`submit failed (${res.status})`);
      const { job_id } = await res.json();
      pollJob(id, job_id);
    } catch (err) {
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "error", result: String(err), endTime: formatNow() } : t))
      );
    }
  };

  const start = (id) => {
    const ticket = tickets.find((t) => t.id === id);
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "running", startTime: formatNow(), endTime: null, result: null } : t))
    );
    if (ticket && LIVE_AGENT_IDS.includes(ticket.agentId)) {
      startLive(id, ticket);
    } else {
      // 未接続のエージェントは、これまでどおりのモック(ランダムに完了/エラー)
      setTimeout(() => {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: Math.random() > 0.15 ? "done" : "error", endTime: formatNow() } : t
          )
        );
      }, 2200 + Math.random() * 1600);
    }
  };

  const visibleTickets = tickets.filter((t) => t.clientId === clientFilter);

  return (
    <div className="min-h-screen w-full bg-[#F3F4F6] text-[#1F2430]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes dropIn {
          0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        textarea::placeholder { color: #8A93A3; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #C7CBD3; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#E2E4E9] px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E8A33D]/15">
            <Zap size={16} className="text-[#E8A33D]" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-[15px] font-semibold tracking-tight">
              DISPATCH
            </h1>
            <p className="text-[11px] text-[#8A93A3]">エージェント指示コンソール</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#8A93A3]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5FB88A]" />
          稼働中のエージェント {AGENTS.length}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-8">
        {/* Queue */}
        <div className="rounded-xl border border-[#E2E4E9] bg-[#FFFFFF]">
          <div className="border-b border-[#E2E4E9] px-5 py-3">
            <span className="mb-2 block text-[10.5px] font-medium tracking-wide text-[#8A93A3]">クライアント</span>
            <div className="flex flex-wrap gap-1.5">
              {clients.map((c) => {
                const id = c.code.toLowerCase();
                return (
                  <button
                    key={id}
                    onClick={() => setClientFilter(id)}
                    className="rounded-full border px-2.5 py-1 font-mono transition-all"
                    style={{
                      borderColor: clientFilter === id ? "#E8A33D" : "#E2E4E9",
                      background: clientFilter === id ? "rgba(232,163,61,0.12)" : "transparent",
                      color: clientFilter === id ? "#E8A33D" : "#6B7280",
                      fontSize: clientFilter === id ? "15px" : "11px",
                      fontWeight: clientFilter === id ? 700 : 400,
                      padding: clientFilter === id ? "6px 14px" : "4px 10px",
                    }}
                  >
                    {`(${c.code})${c.fullName}`}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[#E2E4E9] px-5 py-3.5">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-[13px] font-semibold">
              エージェントへの指示
            </span>
            <span className="font-mono text-[11px] text-[#8A93A3]">{visibleTickets.length} 件</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {clientsStatus === "loading" && (
              <div className="px-5 py-10 text-center text-[12px] text-[#8A93A3]">案件情報を読み込み中...</div>
            )}
            {clientsStatus === "error" && (
              <div className="px-5 py-10 text-center text-[12px] text-[#D4634A]">案件情報の取得に失敗しました</div>
            )}
            {clientsStatus === "ready" && visibleTickets.map((t) => (
              <Ticket
                key={t.id}
                ticket={t}
                onStart={start}
                expanded={expandedId === t.id}
                onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              />
            ))}
            {clientsStatus === "ready" && visibleTickets.length === 0 && (
              <div className="px-5 py-10 text-center text-[12px] text-[#8A93A3]">このクライアントの指示はまだありません</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
