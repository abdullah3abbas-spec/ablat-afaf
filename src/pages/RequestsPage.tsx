/**
 * «المطلوب منّي» — صندوق الطلبات (§ الأمر ٨-ب ثالثاً).
 * تضيف المعلّمة طلباً (أو تصوّر رسالة)، فيُتعرَّف على نوعه محلياً، ويُنتَج
 * المستند من البيانات الموجودة للمراجعة والتوقيع. حالة + موعد + تذكير.
 */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardList, Plus, Printer, Check, RotateCcw, Trash2, Paperclip, Clock } from "lucide-react";
import { db } from "@/db";
import type { RequestType, TeacherRequest } from "@/db/schema";
import { produceRequest, detectRequestType } from "@/lib/generate";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import VisitFileCard from "@/components/VisitFileCard";

const TYPES: RequestType[] = [
  "struggling", "remedial_plan", "activities", "results_stats", "support_enrichment",
  "parent_report", "visit_file", "weekly_message", "experiments", "needs_inventory", "other",
];

const DAY = 86400000;

/** يبني ms من YYYY-MM-DD بأجزاء محلية (تفادي خطأ UTC) */
function dateMsFromInput(v: string): number | undefined {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}
export default function RequestsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const requests = useLiveQuery(async () =>
    (await db.requests.toArray()).filter((r) => !r.deletedAt).sort((a, b) => {
      const rank = (r: TeacherRequest) => (r.status === "delivered" ? 2 : r.status === "ready" ? 1 : 0);
      return rank(a) - rank(b) || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
    })
  );
  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <ClipboardList className="size-7" aria-hidden />
          {s.requests.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.requests.subtitle}</p>
      </div>

      {/* ملف الزيارة الصفية — انتقل من الرئيسية إلى موضعه بين الطلبات (زكريت م١) */}
      <VisitFileCard />

      <div className="rounded-card bg-teal-bg px-4 py-2 text-teal-dark">{s.requests.reviewRule}</div>

      {!adding && (
        <button type="button" onClick={() => setAdding(true)} className="btn-primary">
          <Plus className="size-5" aria-hidden />
          {s.requests.add}
        </button>
      )}
      {adding && <AddForm classes={classes ?? []} onClose={() => setAdding(false)} />}

      {requests && requests.length === 0 ? (
        <p className="card text-ink-soft">{s.requests.empty}</p>
      ) : (
        <ul className="space-y-3">
          {requests?.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              className={classes?.find((c) => c.id === r.classId)?.name}
              confirming={confirmId === r.id}
              onConfirmDelete={() => setConfirmId(r.id!)}
              onCancelDelete={() => setConfirmId(null)}
              numerals={numerals}
              show={show}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddForm({ classes, onClose }: { classes: { id?: number; name: string }[]; onClose: () => void }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const currentClassId = useUi((x) => x.currentClassId);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<RequestType>("other");
  const [typeTouched, setTypeTouched] = useState(false);
  const [classId, setClassId] = useState<number>(currentClassId ?? 0);
  const [studentId, setStudentId] = useState<number>(0);
  const [due, setDue] = useState("");
  const [attachment, setAttachment] = useState<{ blob: Blob; name: string } | null>(null);

  const students = useLiveQuery(
    async () => (classId ? (await db.students.where("classId").equals(classId).toArray()).filter((st) => !st.deletedAt).sort((a, b) => a.rollNumber - b.rollNumber) : []),
    [classId]
  );

  const detected = useMemo(() => detectRequestType(`${title} ${desc}`), [title, desc]);
  const effType = typeTouched ? type : detected;

  async function save() {
    if (!title.trim()) return show(s.requests.titleField, { kind: "danger" });
    const now = Date.now();
    await db.requests.add({
      type: effType,
      title: title.trim(),
      description: desc.trim() || undefined,
      classId: classId || undefined,
      studentId: studentId || undefined,
      dueDate: dateMsFromInput(due),
      status: "new",
      attachment: attachment?.blob,
      attachmentName: attachment?.name,
      createdAt: now,
    });
    show(s.toast?.saved ?? "تم الحفظ ✓");
    onClose();
  }

  const field = "min-h-touch w-full rounded-card border-2 border-line bg-white px-3 focus:border-teal focus:outline-none";

  return (
    <section className="card space-y-3">
      <label className="block space-y-1">
        <span className="font-medium">{s.requests.titleField}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="مثال: تقرير المتعثّرات لخامس ١" />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">{s.requests.descField}</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={field + " py-2"} />
      </label>
      <p className="text-sm text-teal-dark">{s.requests.detected(s.requests.types[detected])} — {s.requests.detectHint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="font-medium">{s.requests.type}</span>
          <select value={effType} onChange={(e) => { setType(e.target.value as RequestType); setTypeTouched(true); }} className={field}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{s.requests.types[t]}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">{s.requests.dueDate}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">{s.requests.forClass}</span>
          <select value={classId} onChange={(e) => { setClassId(Number(e.target.value)); setStudentId(0); }} className={field}>
            <option value={0}>—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {effType === "parent_report" && (
          <label className="block space-y-1">
            <span className="font-medium">{s.requests.forStudent}</span>
            <select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))} className={field}>
              <option value={0}>—</option>
              {students?.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="flex items-center gap-2">
        <Paperclip className="size-5 text-teal-dark" aria-hidden />
        <span className="font-medium">{s.requests.attach}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachment({ blob: f, name: f.name }); }}
          className="text-sm"
        />
        {attachment && <span className="text-sm text-ink-soft">{attachment.name}</span>}
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} className="btn-primary">
          <Plus className="size-5" aria-hidden />
          {s.requests.add}
        </button>
        <button type="button" onClick={onClose} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
      </div>
    </section>
  );
}

type CardProps = {
  req: TeacherRequest;
  className?: string;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  numerals: "western" | "eastern";
  show: (msg: string, opts?: { kind?: "success" | "danger" | "info" }) => void;
};

function RequestCard({ req, className, confirming, onConfirmDelete, onCancelDelete, numerals, show }: CardProps) {
  const s = useStrings();
  const [busy, setBusy] = useState(false);

  const dueInfo = (() => {
    if (!req.dueDate) return null;
    const days = Math.ceil((req.dueDate - Date.now()) / DAY);
    if (days < 0) return { text: s.requests.overdue(fmtNum(-days, numerals)), cls: "bg-danger-bg text-danger" };
    if (days === 0) return { text: s.requests.dueToday, cls: "bg-danger-bg text-danger" };
    if (days <= 2) return { text: s.requests.dueIn(fmtNum(days, numerals)), cls: "bg-gold-bg text-gold-dark" };
    return { text: s.requests.dueIn(fmtNum(days, numerals)), cls: "bg-cream text-ink-soft" };
  })();

  const statusBadge =
    req.status === "delivered" ? { text: s.requests.statusDelivered, cls: "bg-teal-bg text-teal-dark" }
    : req.status === "ready" ? { text: s.requests.statusReady, cls: "bg-gold-bg text-gold-dark" }
    : { text: s.requests.statusNew, cls: "bg-maroon/10 text-maroon" };

  async function produce() {
    setBusy(true);
    try {
      const { ok, reason } = await produceRequest(req);
      if (ok) {
        await db.requests.update(req.id!, { status: "ready", updatedAt: Date.now() });
        show(s.requests.produced);
      } else show(reason ?? "تعذّر التجهيز", { kind: "danger" });
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(status: TeacherRequest["status"]) {
    await db.requests.update(req.id!, { status, updatedAt: Date.now() });
  }
  async function remove() {
    await db.requests.update(req.id!, { deletedAt: Date.now() });
    onCancelDelete();
    show(s.requests.delete, { kind: "info" });
  }

  return (
    <li className={"card space-y-2 " + (req.status === "delivered" ? "opacity-70" : "")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={"rounded-pill px-3 py-1 text-sm font-medium " + statusBadge.cls}>{statusBadge.text}</span>
        <span className="rounded-pill bg-teal-bg px-3 py-1 text-sm text-teal-dark">{s.requests.types[req.type]}</span>
        {dueInfo && <span className={"flex items-center gap-1 rounded-pill px-3 py-1 text-sm " + dueInfo.cls}><Clock className="size-4" aria-hidden />{dueInfo.text}</span>}
        {req.attachmentName && <span className="flex items-center gap-1 text-sm text-ink-soft"><Paperclip className="size-4" aria-hidden />{req.attachmentName}</span>}
      </div>
      <h3 className="text-lg font-bold">{req.title}{className ? <span className="ms-2 text-sm font-normal text-ink-soft">· {className}</span> : null}</h3>
      {req.description && <p className="text-ink-soft">{req.description}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => void produce()} disabled={busy} className="btn-primary disabled:opacity-50">
          <Printer className="size-5" aria-hidden />
          {busy ? s.commandBox.running : s.requests.produce}
        </button>
        {req.status !== "delivered" ? (
          <button type="button" onClick={() => void setStatus("delivered")} className="btn-secondary">
            <Check className="size-5" aria-hidden />
            {s.requests.markDelivered}
          </button>
        ) : (
          <button type="button" onClick={() => void setStatus("new")} className="btn border-2 border-line bg-white text-ink">
            <RotateCcw className="size-5" aria-hidden />
            {s.requests.reopen}
          </button>
        )}
        {confirming ? (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => void remove()} className="btn-danger">{s.common.delete ?? "حذف"}</button>
            <button type="button" onClick={onCancelDelete} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          </span>
        ) : (
          <button type="button" onClick={onConfirmDelete} aria-label={s.requests.delete} className="btn border-2 border-danger bg-white text-danger hover:bg-danger-bg">
            <Trash2 className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
