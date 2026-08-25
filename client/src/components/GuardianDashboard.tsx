import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import SecuritySettings from "@/components/SecuritySettings";
import { cn } from "@/lib/utils";
import {
  Activity,
  BellRing,
  ChevronRight,
  CircleAlert,
  Clock3,
  Hash,
  HeartHandshake,
  Loader2,
  Radio,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const LOG_CATEGORIES = [
  { key: "moderation", label: "الإشراف", detail: "الحظر، الطرد، الميوت، التحذيرات والسجن", color: "#ED4245", icon: ShieldCheck },
  { key: "voice", label: "الصوت", detail: "دخول، خروج، نقل وتغييرات الإدارة الصوتية", color: "#5865F2", icon: Radio },
  { key: "members", label: "الأعضاء", detail: "الانضمام، المغادرة، الملف والرتب", color: "#57F287", icon: Activity },
  { key: "roles", label: "الرتب", detail: "إنشاء، تعديل وحذف الرتب", color: "#FEE75C", icon: Sparkles },
  { key: "channels", label: "القنوات", detail: "إنشاء، تعديل وحذف القنوات", color: "#EB459E", icon: Hash },
  { key: "messages", label: "الرسائل", detail: "حذف وتعديل الرسائل مع حالة قبل/بعد", color: "#FAA61A", icon: BellRing },
  { key: "xp", label: "XP والمستويات", detail: "تعديل XP والارتقاء بالمستوى", color: "#00D4AA", icon: Sparkles },
  { key: "welcome", label: "الترحيب", detail: "إرسال رسائل الترحيب", color: "#57F287", icon: HeartHandshake },
  { key: "interactions", label: "تفاعلات البوت", detail: "الأوامر والرسائل الموجهة للبوت وإجراءاته فقط، بلا حفظ للمحادثات العامة أو الصوت", color: "#C9A7FF", icon: BellRing },
  { key: "system", label: "النظام", detail: "تنبيهات اتصال البوت وأخطاء التسليم", color: "#99AAB5", icon: CircleAlert },
] as const;

type LogCategory = (typeof LOG_CATEGORIES)[number]["key"];

function timeLabel(value: Date | string) {
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function details(raw: string) {
  try { return Object.entries(JSON.parse(raw) as Record<string, string>); } catch { return []; }
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/25 px-6 text-center"><Activity className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-semibold">{title}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p></div>;
}

function GuildSelect({ guilds, guildId, onChange }: { guilds: { id: string; name: string }[]; guildId: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm"><span className="text-muted-foreground">السيرفر</span><select className="min-w-0 flex-1 bg-transparent font-semibold outline-none" value={guildId} onChange={event => onChange(event.target.value)}>{guilds.length === 0 ? <option value="">لا يوجد سيرفر متصل</option> : null}{guilds.map(guild => <option value={guild.id} key={guild.id}>{guild.name}</option>)}</select></label>;
}

function ActivityFeed({ guildId }: { guildId?: string }) {
  const query = trpc.activity.recent.useQuery({ guildId: guildId || undefined, limit: 20 }, { refetchInterval: 20_000 });
  if (query.isLoading) return <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!query.data?.length) return <EmptyState title="لا توجد أحداث مسجلة بعد" detail="سيظهر هنا سجل الأنشطة فور وصول البوت إلى السيرفر وبدء الأحداث." />;
  return <div className="space-y-3">{query.data.map(item => <article key={item.id} className="rounded-2xl border border-border/80 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.accentColor}22`, color: item.accentColor }}><span className="text-base">{item.icon}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Badge variant="outline" className="border-border bg-background/40 text-[11px] text-muted-foreground">{item.category}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.targetLabel ?? "العنصر المستهدف غير متاح"}{item.actorLabel ? ` • بواسطة ${item.actorLabel}` : ""}</p>{item.reason ? <p className="mt-2 rounded-lg bg-background/45 px-3 py-2 text-sm text-secondary-foreground">السبب: {item.reason}</p> : null}{details(item.detailsJson).length ? <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">{details(item.detailsJson).slice(0, 4).map(([name, value]) => <span key={name}><strong className="text-secondary-foreground">{name}:</strong> {value}</span>)}</div> : null}</div><time className="shrink-0 text-xs text-muted-foreground">{timeLabel(item.createdAt)}</time></div></article>)}</div>;
}

function LogRouting({ guildId }: { guildId: string }) {
  const routes = trpc.logging.routes.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const channels = trpc.dashboard.channels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const saveRoute = trpc.logging.saveRoute.useMutation({ onSuccess: () => { void routes.refetch(); toast.success("تم حفظ توجيه اللوقات"); }, onError: error => toast.error(error.message) });
  if (!guildId) return <EmptyState title="اختر سيرفراً أولاً" detail="بمجرد اتصال البوت بسيرفر، ستتمكن من تعيين قناة مستقلة لكل فئة من اللوقات." />;
  if (routes.isLoading || channels.isLoading) return <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <div className="grid gap-3">{channels.data?.length === 0 ? <div className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>لا توجد قناة يمكن لمجلساوي الإرسال إليها. من Discord افتح رتبة البوت أو صلاحيات القناة ومنحه <strong>View Channel</strong> و<strong>Send Messages</strong> و<strong>Embed Links</strong>، ثم حدّث الصفحة.</p></div> : null}{LOG_CATEGORIES.map(category => { const route = routes.data?.find(item => item.category === category.key); const Icon = category.icon; return <section key={category.key} className="guardian-surface grid gap-4 rounded-2xl border border-border p-4 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-center"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${category.color}22`, color: category.color }}><Icon className="h-5 w-5" /></div><div><h3 className="font-semibold">{category.label}</h3><p className="mt-0.5 text-sm text-muted-foreground">{category.detail}</p></div></div><select aria-label={`قناة لوقات ${category.label}`} className="h-10 w-full rounded-xl border border-input bg-background/65 px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring" value={route?.channelId ?? ""} onChange={event => saveRoute.mutate({ guildId, category: category.key, channelId: event.target.value, enabled: Boolean(event.target.value) })}><option value="">إيقاف هذه الفئة</option>{channels.data?.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select><Badge className={cn("h-7 justify-center", route?.enabled ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-muted text-muted-foreground hover:bg-muted")}>{route?.enabled ? "مفعّل" : "متوقف"}</Badge></section>; })}</div>;
}

function WelcomeSettings({ guildId, guildName }: { guildId: string; guildName: string }) {
  const settings = trpc.settings.get.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const channels = trpc.dashboard.channels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const [enabled, setEnabled] = useState(false); const [channelId, setChannelId] = useState(""); const [message, setMessage] = useState("مرحباً {user} في **{server}**!");
  useEffect(() => { if (settings.data) { setEnabled(settings.data.welcomeEnabled); setChannelId(settings.data.welcomeChannelId ?? ""); setMessage(settings.data.welcomeMessage ?? "مرحباً {user} في **{server}**!"); } }, [settings.data]);
  const save = trpc.settings.save.useMutation({ onSuccess: () => { void settings.refetch(); toast.success("تم حفظ إعدادات الترحيب"); }, onError: error => toast.error(error.message) });
  const sendPreview = trpc.welcome.sendPreview.useMutation({ onSuccess: () => toast.success("تم إرسال معاينة بطاقة الترحيب إلى الروم المحدد"), onError: error => toast.error(error.message) });
  if (!guildId) return <EmptyState title="اختر سيرفراً أولاً" detail="إعدادات الترحيب تظهر بعد اتصال البوت بسيرفرك." />;
  const previewMessage = message.replace("{user}", "@عضو جديد").replace("{server}", guildName).replace(/[*_`#]/g, "");
  return <section className="guardian-surface max-w-3xl rounded-2xl border border-border p-6">
    <div className="flex items-center justify-between gap-4 border-b border-border pb-5"><div><h2 className="flex items-center gap-2 text-lg font-bold"><HeartHandshake className="h-5 w-5 text-emerald-300" />رسائل الترحيب المصوّرة</h2><p className="mt-1 text-sm text-muted-foreground">يرسل البوت بطاقة PNG ديناميكية مع صورة العضو واسمه واسم السيرفر.</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
    <div className="mt-6 grid gap-5">
      <div className="overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-[#3a2411] via-[#b8843e] to-[#f4e5bf] p-5 text-center shadow-inner">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-100 bg-[#291b11] text-xl font-black text-amber-100">A</div>
        <p className="mt-3 text-xs font-semibold tracking-[0.18em] text-amber-900/80">أهلاً وسهلاً بك في</p>
        <h3 className="mt-1 text-2xl font-black text-[#5f3b12]">{guildName}</h3>
        <p className="mt-3 text-sm font-semibold text-[#4b3115]">{previewMessage}</p>
        <p className="mt-4 text-[10px] tracking-[0.2em] text-[#6b461a]">DYNAMIC WELCOME CARD</p>
      </div>
      <label className="grid gap-2 text-sm font-medium">قناة الترحيب<select className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" value={channelId} onChange={event => setChannelId(event.target.value)}><option value="">اختر قناة نصية</option>{channels.data?.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium">نص الرسالة<Textarea value={message} onChange={event => setMessage(event.target.value)} className="min-h-32 bg-background/65 leading-7" /><span className="text-xs font-normal text-muted-foreground">استخدم <code className="rounded bg-secondary px-1.5 py-0.5">{"{user}"}</code> لذكر العضو و<code className="rounded bg-secondary px-1.5 py-0.5">{"{server}"}</code> لاسم السيرفر. سيظهر النص داخل البطاقة المرسلة.</span></label>
    </div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="outline" className="bg-background/45" disabled={sendPreview.isPending || !channelId} onClick={() => sendPreview.mutate({ guildId })}><Sparkles className="ml-2 h-4 w-4" />إرسال معاينة للروم</Button><Button disabled={save.isPending} onClick={() => save.mutate({ guildId, guildName, welcomeEnabled: enabled, welcomeChannelId: channelId || null, welcomeMessage: message, botEnabled: settings.data?.botEnabled ?? true, mutedRoleId: settings.data?.mutedRoleId ?? null, jailRoleId: settings.data?.jailRoleId ?? null, warningLimit: settings.data?.warningLimit ?? 3 })}><Save className="ml-2 h-4 w-4" />حفظ الترحيب</Button></div>
  </section>;
}

function ModerationSettings({ guildId, guildName }: { guildId: string; guildName: string }) {
  return <SecuritySettings guildId={guildId} guildName={guildName} />;
  const settings = trpc.settings.get.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const [jailRoleId, setJailRoleId] = useState(""); const [warningLimit, setWarningLimit] = useState(3);
  useEffect(() => { if (settings.data) { setJailRoleId(settings.data.jailRoleId ?? ""); setWarningLimit(settings.data.warningLimit); } }, [settings.data]);
  const save = trpc.settings.save.useMutation({ onSuccess: () => { void settings.refetch(); toast.success("تم حفظ قواعد الإشراف"); }, onError: error => toast.error(error.message) });
  if (!guildId) return <EmptyState title="اختر سيرفراً أولاً" detail="ستظهر قواعد الإشراف بمجرد اتصال البوت بسيرفرك." />;
  return <section className="guardian-surface max-w-3xl rounded-2xl border border-border p-6"><div className="border-b border-border pb-5"><h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-red-300" />قواعد الإشراف</h2><p className="mt-1 text-sm text-muted-foreground">تُسجَّل كل الأوامر الإشرافية في Embeds متكاملة بالمُنفّذ والمتأثر والسبب والوقت.</p></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">معرّف رتبة السجن<Input value={jailRoleId} onChange={event => setJailRoleId(event.target.value)} placeholder="Discord Role ID" className="bg-background/65" /><span className="text-xs font-normal text-muted-foreground">يُستخدم بواسطة أوامر <code className="rounded bg-secondary px-1.5 py-0.5">/jail</code> و<code className="rounded bg-secondary px-1.5 py-0.5">/unjail</code>.</span></label><label className="grid gap-2 text-sm font-medium">حد التحذيرات<Input type="number" min={1} max={20} value={warningLimit} onChange={event => setWarningLimit(Number(event.target.value))} className="bg-background/65" /><span className="text-xs font-normal text-muted-foreground">عداد قواعد السيرفر؛ التنفيذ التلقائي قابل للتوسعة فوق هذا الأساس.</span></label></div><div className="mt-6 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-secondary-foreground"><strong>الأوامر المتاحة:</strong> /ban، /kick، /mute، /unmute، /deafen، /undeafen، /warn، /jail، /unjail، و/xp.</div><div className="mt-6 flex justify-end"><Button disabled={save.isPending} onClick={() => save.mutate({ guildId, guildName, botEnabled: settings.data?.botEnabled ?? true, welcomeEnabled: settings.data?.welcomeEnabled ?? false, welcomeChannelId: settings.data?.welcomeChannelId ?? null, welcomeMessage: settings.data?.welcomeMessage ?? null, jailRoleId: jailRoleId || null, mutedRoleId: settings.data?.mutedRoleId ?? null, warningLimit })}><Save className="ml-2 h-4 w-4" />حفظ قواعد الإشراف</Button></div></section>;
}

export default function GuardianDashboard() {
  const [location] = useLocation(); const status = trpc.dashboard.status.useQuery(undefined, { refetchInterval: 15_000 }); const [guildId, setGuildId] = useState("");
  const guilds = useMemo(() => { const connected = status.data?.guilds ?? []; const configured = status.data?.configuredGuilds.map(item => ({ id: item.guildId, name: item.guildName })) ?? []; return [...connected, ...configured.filter(item => !connected.some(guild => guild.id === item.id))]; }, [status.data]);
  useEffect(() => { if (!guildId && guilds[0]) setGuildId(guilds[0].id); }, [guildId, guilds]);
  const selectedGuild = guilds.find(guild => guild.id === guildId); const page = location === "/logs" ? "logs" : location === "/moderation" ? "moderation" : location === "/welcome" ? "welcome" : "overview";
  const title = page === "logs" ? "اللوقات والتوجيه" : page === "moderation" ? "الإشراف والحماية" : page === "welcome" ? "الترحيب" : "مركز التحكم"; const subtitle = page === "logs" ? "اربط كل فئة من اللوقات بقناة مستقلة داخل Discord." : page === "moderation" ? "اضبط أساسيات الأوامر الإشرافية القابلة للتدقيق." : page === "welcome" ? "خصّص تجربة العضو الجديد دون التضحية بالتحكم." : "رؤية فورية لصحة البوت وأحدث الأحداث المسجلة.";
  if (status.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  return <div className="guardian-grid min-h-full p-1"><div className="mx-auto max-w-7xl px-2 py-5 sm:px-5"><header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary"><ShieldCheck className="h-4 w-4" />مجلساوي</div><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div><div className="flex flex-wrap items-center gap-3"><GuildSelect guilds={guilds} guildId={guildId} onChange={setGuildId} /><Badge className={cn("h-10 gap-2 rounded-xl px-3", status.data?.bot.connected ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-red-500/15 text-red-300 hover:bg-red-500/15")}><span className={cn("h-2 w-2 rounded-full", status.data?.bot.connected ? "bg-emerald-300" : "bg-red-300")} />{status.data?.bot.connected ? "البوت متصل" : "البوت غير متصل"}</Badge></div></header>{page === "overview" ? <><div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[{ label: "حالة الاتصال", value: status.data?.bot.connected ? "متصل" : "بانتظار الاتصال", icon: Radio, accent: "text-indigo-300" }, { label: "السيرفرات المتصلة", value: `${status.data?.bot.guildCount ?? 0}`, icon: ShieldCheck, accent: "text-emerald-300" }, { label: "نطق /say", value: status.data?.voice.sayReady ? "جاهز" : "ينقص Voice ID", icon: BellRing, accent: status.data?.voice.sayReady ? "text-emerald-300" : "text-amber-300" }, { label: "سوالف الروم", value: status.data?.voice.conversationReady ? "جاهز" : "ينقص Agent ID", icon: Radio, accent: status.data?.voice.conversationReady ? "text-emerald-300" : "text-amber-300" }, { label: "آخر تشغيل", value: status.data?.bot.startedAt ? timeLabel(status.data.bot.startedAt) : "—", icon: Clock3, accent: "text-pink-300" }].map(metric => <section key={metric.label} className="guardian-surface rounded-2xl border border-border p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{metric.label}</span><metric.icon className={cn("h-5 w-5", metric.accent)} /></div><p className="mt-4 text-2xl font-bold">{metric.value}</p></section>)}</div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><section className="guardian-surface rounded-2xl border border-border p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">سجل النشاط الحديث</h2><p className="mt-1 text-sm text-muted-foreground">نسخة لوحة التحكم من اللوقات المرسلة إلى Discord.</p></div><Activity className="h-5 w-5 text-primary" /></div><ActivityFeed guildId={guildId} /></section><aside className="guardian-surface rounded-2xl border border-border p-5"><h2 className="font-bold">جاهزية اللوقات</h2><p className="mt-1 text-sm text-muted-foreground">المسارات قابلة للتخصيص بالكامل لكل سيرفر.</p><div className="mt-5 space-y-3">{LOG_CATEGORIES.slice(0, 6).map(category => <div key={category.key} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} /><span className="flex-1 text-sm">{category.label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>)}</div><Button variant="outline" className="mt-5 w-full bg-background/40" onClick={() => window.location.assign("/logs")}>ضبط توجيه اللوقات</Button></aside></div></> : null}{page === "logs" ? <LogRouting guildId={guildId} /> : null}{page === "moderation" ? <ModerationSettings guildId={guildId} guildName={selectedGuild?.name ?? "Discord Server"} /> : null}{page === "welcome" ? <WelcomeSettings guildId={guildId} guildName={selectedGuild?.name ?? "Discord Server"} /> : null}</div></div>;
}
