import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import RoleShopAdmin from "@/components/RoleShopAdmin";
import StreamAnnouncements from "@/components/StreamAnnouncements";
import TicketManagement from "@/components/TicketManagement";
import { filterCommunityProgramRows } from "@/components/communityProgramRows";
import { BadgeDollarSign, CalendarDays, ChevronDown, ClipboardList, Gift, Lightbulb, Loader2, RadioTower, Search, Ticket, Vote } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ProgramId = "events" | "giveaways" | "engagement" | "tickets" | "streams" | "shop" | "ticketManagement";

function ProgramRow({
  title,
  command,
  description,
  icon,
  count,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  command: string;
  description: string;
  icon: React.ReactNode;
  count: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return <Collapsible open={open} onOpenChange={onOpenChange} className="guardian-surface rounded-2xl border border-border">
    <div className="flex items-center gap-3 p-4 sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70">{icon}</div>
      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold">{title}</h2><p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{description}</p><p className="mt-1 text-xs text-muted-foreground">{count} <span className="mx-1 text-border">•</span><code className="rounded bg-background/70 px-1.5 py-0.5 text-[11px] text-primary">{command}</code></p></div>
      <CollapsibleTrigger asChild><Button variant="outline" size="sm" className="shrink-0 gap-1.5" aria-label={`${open ? "إغلاق" : "تعديل"} ${title}`}>{open ? "إغلاق" : "تعديل"}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger>
    </div>
    <CollapsibleContent><div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">{children}</div></CollapsibleContent>
  </Collapsible>;
}

export default function CommunityPrograms({ guildId }: { guildId: string }) {
  const channels = trpc.dashboard.channels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const ticketCategories = trpc.dashboard.ticketCategories.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const roles = trpc.dashboard.roles.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const events = trpc.community.events.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const giveaways = trpc.community.giveaways.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const polls = trpc.community.polls.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const panels = trpc.community.ticketPanels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const suggestions = trpc.community.suggestions.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const [channelId, setChannelId] = useState("");
  const [eventTitle, setEventTitle] = useState(""); const [eventDescription, setEventDescription] = useState(""); const [eventDate, setEventDate] = useState("");
  const [giveawayPrize, setGiveawayPrize] = useState(""); const [giveawayMinutes, setGiveawayMinutes] = useState(60); const [giveawayWinners, setGiveawayWinners] = useState(1);
  const [pollQuestion, setPollQuestion] = useState(""); const [pollOptions, setPollOptions] = useState(""); const [pollAnonymous, setPollAnonymous] = useState(false);
  const [ticketRoleId, setTicketRoleId] = useState(""); const [ticketCategoryId, setTicketCategoryId] = useState(""); const [ticketTitle, setTicketTitle] = useState("الدعم الفني"); const [ticketDescription, setTicketDescription] = useState("اضغط هنا لفتح تذكرة خاصة مع الفريق.");
  const [suggestion, setSuggestion] = useState(""); const [anonymousSuggestion, setAnonymousSuggestion] = useState(false);
  const [query, setQuery] = useState(""); const [openProgram, setOpenProgram] = useState<ProgramId | null>("events");
  const input = "h-10 rounded-xl border border-input bg-background/65 px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  const visiblePrograms = useMemo(() => new Set(filterCommunityProgramRows(query).map(row => row.id)), [query]);
  const refresh = () => { void events.refetch(); void giveaways.refetch(); void polls.refetch(); void panels.refetch(); void suggestions.refetch(); };
  const createEvent = trpc.community.createEvent.useMutation({ onSuccess: () => { refresh(); setEventTitle(""); setEventDescription(""); toast.success("تم حفظ الفعالية"); }, onError: error => toast.error(error.message) });
  const createGiveaway = trpc.community.createGiveaway.useMutation({ onSuccess: () => { refresh(); setGiveawayPrize(""); toast.success("تم حفظ السحب"); }, onError: error => toast.error(error.message) });
  const createPoll = trpc.community.createPoll.useMutation({ onSuccess: () => { refresh(); setPollQuestion(""); setPollOptions(""); toast.success("تم حفظ التصويت"); }, onError: error => toast.error(error.message) });
  const createTicket = trpc.community.createTicketPanel.useMutation({ onSuccess: () => { refresh(); toast.success("تم حفظ لوحة التذاكر"); }, onError: error => toast.error(error.message) });
  const createSuggestion = trpc.community.createSuggestion.useMutation({ onSuccess: () => { refresh(); setSuggestion(""); toast.success("تم حفظ الاقتراح"); }, onError: error => toast.error(error.message) });
  const selectedChannel = <label className="grid gap-2 text-sm font-medium">القناة<select className={input} value={channelId} onChange={event => setChannelId(event.target.value)}><option value="">اختر قناة</option>{channels.data?.map(channel => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></label>;
  const setOpen = (id: ProgramId) => (open: boolean) => setOpenProgram(open ? id : null);
  if (!guildId || (channels.isLoading && !channels.data)) return <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <section className="grid gap-5">
    <div className="guardian-surface rounded-2xl border border-border p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold">برامج المجتمع</h2><p className="mt-1 text-sm text-muted-foreground">ابحث عن النظام ثم افتح صفه لتعديل إعداداته.</p></div><label className="relative block sm:w-72"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} className="pr-9" placeholder="بحث: تذاكر، سحب، /poll..." aria-label="بحث في برامج المجتمع" /></label></div></div>
    <div className="grid gap-3">
      {visiblePrograms.has("events") && <ProgramRow title="الفعاليات والتقويم" command="/event · /eventend" description="اضبط الفعالية وموعدها، ثم اعرض خلاصة RSVP المجمعة عند الإنهاء." icon={<CalendarDays className="h-5 w-5 text-emerald-300" />} count={`فعاليات محفوظة: ${events.data?.length ?? 0}`} open={openProgram === "events"} onOpenChange={setOpen("events")}><div className="grid gap-3">{selectedChannel}<Input placeholder="عنوان الفعالية" value={eventTitle} onChange={event => setEventTitle(event.target.value)} /><Textarea placeholder="وصف الفعالية" value={eventDescription} onChange={event => setEventDescription(event.target.value)} /><Input type="datetime-local" value={eventDate} onChange={event => setEventDate(event.target.value)} /><Button disabled={!channelId || !eventTitle || !eventDescription || !eventDate || createEvent.isPending} onClick={() => createEvent.mutate({ guildId, channelId, title: eventTitle, description: eventDescription, startsAt: new Date(eventDate), reminderMinutes: 30 })}>حفظ الفعالية</Button></div></ProgramRow>}
      {visiblePrograms.has("giveaways") && <ProgramRow title="السحوبات والجوائز" command="/giveaway" description="حدد الجائزة والمدة وعدد الفائزين؛ النشر والدخول يتمان عبر Discord." icon={<Gift className="h-5 w-5 text-amber-300" />} count={`سحوبات محفوظة: ${giveaways.data?.length ?? 0}`} open={openProgram === "giveaways"} onOpenChange={setOpen("giveaways")}><div className="grid gap-3">{selectedChannel}<Input placeholder="اسم الجائزة" value={giveawayPrize} onChange={event => setGiveawayPrize(event.target.value)} /><div className="grid grid-cols-2 gap-3"><Input type="number" min={1} value={giveawayMinutes} onChange={event => setGiveawayMinutes(Number(event.target.value))} placeholder="المدة بالدقائق" /><Input type="number" min={1} value={giveawayWinners} onChange={event => setGiveawayWinners(Number(event.target.value))} placeholder="الفائزون" /></div><Button disabled={!channelId || !giveawayPrize || createGiveaway.isPending} onClick={() => createGiveaway.mutate({ guildId, channelId, prize: giveawayPrize, winnerCount: giveawayWinners, minimumLevel: 0, endsAt: new Date(Date.now() + giveawayMinutes * 60_000) })}>حفظ السحب</Button></div></ProgramRow>}
      {visiblePrograms.has("engagement") && <ProgramRow title="التصويتات والاقتراحات" command="/poll · /pollend · /suggest" description="أنشئ تصويتاً أو اقتراحاً ثم أدِر حالة الاقتراح من أزرار Discord المقيدة بالفريق." icon={<Vote className="h-5 w-5 text-indigo-300" />} count={`تصويتات: ${polls.data?.length ?? 0} • اقتراحات: ${suggestions.data?.length ?? 0}`} open={openProgram === "engagement"} onOpenChange={setOpen("engagement")}><div className="grid gap-3">{selectedChannel}<Input placeholder="سؤال التصويت" value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} /><Input placeholder="خيار 1 | خيار 2 | خيار 3" value={pollOptions} onChange={event => setPollOptions(event.target.value)} /><label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">تصويت مجهول<Switch checked={pollAnonymous} onCheckedChange={setPollAnonymous} /></label><Button disabled={!channelId || !pollQuestion || !pollOptions || createPoll.isPending} onClick={() => createPoll.mutate({ guildId, channelId, question: pollQuestion, anonymous: pollAnonymous, options: pollOptions.split("|").map(value => value.trim()).filter(Boolean) })}>حفظ التصويت</Button><Textarea placeholder="إضافة اقتراح من لوحة التحكم" value={suggestion} onChange={event => setSuggestion(event.target.value)} /><label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">اقتراح مجهول<Switch checked={anonymousSuggestion} onCheckedChange={setAnonymousSuggestion} /></label><Button variant="outline" disabled={!channelId || !suggestion || createSuggestion.isPending} onClick={() => createSuggestion.mutate({ guildId, channelId, content: suggestion, anonymous: anonymousSuggestion })}><Lightbulb className="ml-2 h-4 w-4" />حفظ اقتراح</Button><div className="grid gap-2 border-t border-border pt-3"><p className="text-xs font-semibold text-muted-foreground">أحدث الاقتراحات</p>{suggestions.data?.length ? suggestions.data.slice(0, 5).map(item => <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-background/55 px-3 py-2 text-xs"><p className="min-w-0 break-words text-foreground">{item.content.slice(0, 140)}{item.content.length > 140 ? "…" : ""}</p><span className={`shrink-0 rounded-md px-2 py-1 ${item.status === "accepted" ? "bg-emerald-500/15 text-emerald-200" : item.status === "declined" ? "bg-red-500/15 text-red-200" : item.status === "implemented" ? "bg-indigo-500/15 text-indigo-200" : "bg-amber-500/15 text-amber-200"}`}>{item.status === "accepted" ? "مقبول" : item.status === "declined" ? "مرفوض" : item.status === "implemented" ? "تم التنفيذ" : "مفتوح"}</span></div>) : <p className="text-xs text-muted-foreground">لا توجد اقتراحات مسجلة بعد.</p>}</div></div></ProgramRow>}
      {visiblePrograms.has("tickets") && <ProgramRow title="تذاكر الدعم" command="/ticketpanel · /ticketsummary" description="اضبط قناة اللوحة ورتبة الفريق وفئة Discord الاختيارية، ثم انشر اللوحة بالأمر." icon={<Ticket className="h-5 w-5 text-sky-300" />} count={`لوحات محفوظة: ${panels.data?.length ?? 0} • فئات متاحة: ${ticketCategories.data?.length ?? 0}`} open={openProgram === "tickets"} onOpenChange={setOpen("tickets")}><div className="grid gap-3">{selectedChannel}<label className="grid gap-2 text-sm font-medium">فئة التذاكر <span className="text-xs font-normal text-muted-foreground">اختياري</span><select className={input} value={ticketCategoryId} onChange={event => setTicketCategoryId(event.target.value)}><option value="">بدون فئة / تحت السيرفر</option>{ticketCategories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">رتبة الفريق<select className={input} value={ticketRoleId} onChange={event => setTicketRoleId(event.target.value)}><option value="">اختر رتبة</option>{roles.data?.map(role => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label><Input value={ticketTitle} onChange={event => setTicketTitle(event.target.value)} /><Textarea value={ticketDescription} onChange={event => setTicketDescription(event.target.value)} /><Button disabled={!channelId || !ticketRoleId || createTicket.isPending} onClick={() => createTicket.mutate({ guildId, channelId, categoryId: ticketCategoryId || null, staffRoleId: ticketRoleId, title: ticketTitle, description: ticketDescription })}>حفظ لوحة التذاكر</Button></div></ProgramRow>}
      {visiblePrograms.has("ticketManagement") && <ProgramRow title="إدارة التذاكر القائمة" command="/ticketclaim · /ticketclose" description="راجع حالة التذاكر وملاحظات الملخص المسموح بها للفريق من دون عرض أو حفظ محادثة التذكرة." icon={<ClipboardList className="h-5 w-5 text-cyan-300" />} count="صلاحيات فريق الدعم مطلوبة" open={openProgram === "ticketManagement"} onOpenChange={setOpen("ticketManagement")}><TicketManagement guildId={guildId} /></ProgramRow>}
      {visiblePrograms.has("shop") && <ProgramRow title="متجر الرتب" command="/shop · /buyrole" description="اضف الرتب الآمنة وأسعارها ليشتريها الأعضاء من رصيدهم داخل السيرفر." icon={<BadgeDollarSign className="h-5 w-5 text-amber-300" />} count="رتب قابلة للشراء من المتجر" open={openProgram === "shop"} onOpenChange={setOpen("shop")}><RoleShopAdmin guildId={guildId} /></ProgramRow>}
      {visiblePrograms.has("streams") && <ProgramRow title="إعلانات البث" command="Webhook · اختبار إعلان" description="أنشئ رابط استقبال سرياً لأي منصة بث، مع منع التكرار وعدم حفظ جسم الطلب." icon={<RadioTower className="h-5 w-5 text-rose-300" />} count="رابط استقبال مستقل لكل إعداد" open={openProgram === "streams"} onOpenChange={setOpen("streams")}><StreamAnnouncements guildId={guildId} /></ProgramRow>}
      {!visiblePrograms.size && <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">لا توجد برامج مطابقة لعبارة البحث.</div>}
    </div>
  </section>;
}
