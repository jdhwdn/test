import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookOpenCheck, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function CommunityKnowledge({ guildId, embedded = false }: { guildId: string; embedded?: boolean }) {
  const items = trpc.community.knowledge.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const [kind, setKind] = useState<"rule" | "faq">("rule");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const create = trpc.community.createKnowledge.useMutation({ onSuccess: () => { void items.refetch(); setTitle(""); setContent(""); toast.success("تمت إضافة المعرفة للمساعد المحلي"); }, onError: error => toast.error(error.message) });
  const remove = trpc.community.deleteKnowledge.useMutation({ onSuccess: () => { void items.refetch(); toast.success("تم حذف العنصر"); }, onError: error => toast.error(error.message) });
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return items.data ?? [];
    return (items.data ?? []).filter(item => `${item.title} ${item.content} ${item.kind}`.toLocaleLowerCase("ar").includes(normalized));
  }, [items.data, query]);

  if (!guildId) return null;
  return <section className={embedded ? "grid gap-4" : "guardian-surface rounded-2xl border border-border p-5"}>
    {!embedded ? <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><BookOpenCheck className="h-5 w-5" /></div><div><p className="text-xs font-bold tracking-[0.14em] text-violet-300">APPROVED KNOWLEDGE</p><h3 className="mt-1 font-bold">قوانين وأسئلة شائعة للمساعد المحلي</h3><p className="mt-1 text-sm text-muted-foreground">يجيب `/help` و`/faq` من هذه العناصر فقط؛ لا يحتاج API ولا يحتفظ بسؤال العضو.</p></div></div> : <p className="text-sm text-muted-foreground">يجيب <code>/help</code> و<code>/faq</code> من هذه العناصر فقط؛ لا يحتاج API ولا يحتفظ بسؤال العضو.</p>}
    <div className={embedded ? "grid gap-3 md:grid-cols-2" : "mt-4 grid gap-3 md:grid-cols-2"}><label className="grid gap-2 text-sm font-medium">النوع<select className="h-10 rounded-xl border border-input bg-background/65 px-3 text-sm" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="rule">قانون</option><option value="faq">سؤال شائع</option></select></label><label className="grid gap-2 text-sm font-medium">العنوان<Input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} placeholder="مثال: سياسة الروابط" /></label></div>
    <label className="mt-3 grid gap-2 text-sm font-medium">المحتوى<Textarea value={content} maxLength={4000} onChange={event => setContent(event.target.value)} placeholder="الجواب أو القاعدة التي توافق على أن يشرحها البوت." /></label>
    <div className="mt-3 flex justify-end"><Button disabled={!title.trim() || !content.trim() || create.isPending} onClick={() => create.mutate({ guildId, kind, title, content, enabled: true })}><Plus className="ml-2 h-4 w-4" />إضافة للمساعد</Button></div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{filteredItems.length} من {items.data?.length ?? 0} عناصر معرفة معتمدة</p><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pr-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في العنوان أو المحتوى" aria-label="بحث في المعرفة المعتمدة" /></div></div>
    <div className="mt-3 grid gap-2">{filteredItems.map(item => <article className="flex items-start gap-3 rounded-xl border border-border bg-black/10 p-3" key={item.id}><span className={item.kind === "rule" ? "rounded-md bg-rose-400/10 px-2 py-1 text-xs text-rose-200" : "rounded-md bg-sky-400/10 px-2 py-1 text-xs text-sky-200"}>{item.kind === "rule" ? "قانون" : "FAQ"}</span><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p></div><Button variant="ghost" size="icon" className="text-destructive" aria-label="حذف عنصر المعرفة" disabled={remove.isPending} onClick={() => remove.mutate({ guildId, id: item.id })}><Trash2 className="h-4 w-4" /></Button></article>)}{items.data?.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">لا توجد معرفة معتمدة بعد.</p> : filteredItems.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة للبحث.</p> : null}</div>
  </section>;
}
