import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import CommunityKnowledge from "@/components/CommunityKnowledge";
import { filterCommunitySettingsRows } from "@/components/communitySettingsRows";
import { BrainCircuit, ChevronDown, Loader2, Plus, Save, Search, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Props = { guildId: string; guildName: string };
type SettingsRowId = "xp" | "safety" | "assistant" | "knowledge";

function SettingsRow({ title, command, description, icon, open, onOpenChange, children }: { title: string; command: string; description: string; icon: ReactNode; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <Collapsible open={open} onOpenChange={onOpenChange} className="guardian-surface rounded-2xl border border-border">
    <div className="flex items-center gap-3 p-4 sm:p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70">{icon}</div><div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold">{title}</h2><p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{description}</p><code className="mt-1 inline-block rounded bg-background/70 px-1.5 py-0.5 text-[11px] text-primary">{command}</code></div><CollapsibleTrigger asChild><Button variant="outline" size="sm" className="shrink-0 gap-1.5" aria-label={`${open ? "إغلاق" : "تعديل"} ${title}`}>{open ? "إغلاق" : "تعديل"}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger></div>
    <CollapsibleContent><div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">{children}</div></CollapsibleContent>
  </Collapsible>;
}

export default function CommunitySettings({ guildId, guildName }: Props) {
  const settings = trpc.settings.get.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const channels = trpc.dashboard.channels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const roles = trpc.dashboard.roles.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const rewards = trpc.xp.rewards.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const leaderboard = trpc.xp.leaderboard.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const rules = trpc.automod.list.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const utils = trpc.useUtils();

  const [xpEnabled, setXpEnabled] = useState(true);
  const [xpPerMessage, setXpPerMessage] = useState(15);
  const [xpCooldownSeconds, setXpCooldownSeconds] = useState(60);
  const [xpAnnouncementChannelId, setXpAnnouncementChannelId] = useState("");
  const [xpLevelUpMessage, setXpLevelUpMessage] = useState("مبروك {user}! وصلت للمستوى {level}.");
  const [antiSpamEnabled, setAntiSpamEnabled] = useState(false);
  const [antiSpamMaxMessages, setAntiSpamMaxMessages] = useState(6);
  const [antiSpamWindowSeconds, setAntiSpamWindowSeconds] = useState(10);
  const [antiLinkEnabled, setAntiLinkEnabled] = useState(false);
  const [antiBotEnabled, setAntiBotEnabled] = useState(false);
  const [antiRaidEnabled, setAntiRaidEnabled] = useState(false);
  const [antiRaidJoinLimit, setAntiRaidJoinLimit] = useState(8);
  const [antiRaidWindowSeconds, setAntiRaidWindowSeconds] = useState(60);
  const [autoMuteMinutes, setAutoMuteMinutes] = useState(10);
  const [warningExpiryDays, setWarningExpiryDays] = useState(30);
  const [autoKickEnabled, setAutoKickEnabled] = useState(false);
  const [moderatorReportChannelId, setModeratorReportChannelId] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiRulesText, setAiRulesText] = useState("");
  const [aiTranslationEnabled, setAiTranslationEnabled] = useState(false);
  const [aiTicketSummariesEnabled, setAiTicketSummariesEnabled] = useState(false);
  const [rewardLevel, setRewardLevel] = useState(1);
  const [rewardRoleId, setRewardRoleId] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"keyword" | "invite" | "caps" | "flood">("keyword");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleAction, setRuleAction] = useState<"delete" | "warn" | "mute" | "kick">("delete");
  const [filter, setFilter] = useState("");
  const [openSettings, setOpenSettings] = useState<SettingsRowId | null>("xp");

  useEffect(() => {
    const value = settings.data;
    if (!value) return;
    setXpEnabled(value.xpEnabled); setXpPerMessage(value.xpPerMessage); setXpCooldownSeconds(value.xpCooldownSeconds);
    setXpAnnouncementChannelId(value.xpAnnouncementChannelId ?? ""); setXpLevelUpMessage(value.xpLevelUpMessage ?? "مبروك {user}! وصلت للمستوى {level}.");
    setAntiSpamEnabled(value.antiSpamEnabled); setAntiSpamMaxMessages(value.antiSpamMaxMessages); setAntiSpamWindowSeconds(value.antiSpamWindowSeconds);
    setAntiLinkEnabled(value.antiLinkEnabled); setAntiBotEnabled(value.antiBotEnabled); setAntiRaidEnabled(value.antiRaidEnabled);
    setAntiRaidJoinLimit(value.antiRaidJoinLimit); setAntiRaidWindowSeconds(value.antiRaidWindowSeconds); setAutoMuteMinutes(value.autoMuteMinutes); setWarningExpiryDays(value.warningExpiryDays);
    setAutoKickEnabled(value.autoKickEnabled);
    setModeratorReportChannelId(value.moderatorReportChannelId ?? ""); setAiEnabled(value.aiEnabled); setAiRulesText(value.aiRulesText ?? "");
    setAiTranslationEnabled(value.aiTranslationEnabled); setAiTicketSummariesEnabled(value.aiTicketSummariesEnabled);
  }, [settings.data]);

  const save = trpc.settings.save.useMutation({ onSuccess: () => { void settings.refetch(); toast.success("تم حفظ تحكم المجتمع والحماية"); }, onError: error => toast.error(error.message) });
  const saveReward = trpc.xp.saveReward.useMutation({ onSuccess: () => { void rewards.refetch(); toast.success("تم حفظ رتبة المستوى"); }, onError: error => toast.error(error.message) });
  const removeReward = trpc.xp.removeReward.useMutation({ onSuccess: () => void rewards.refetch(), onError: error => toast.error(error.message) });
  const createRule = trpc.automod.create.useMutation({ onSuccess: () => { void rules.refetch(); setRuleName(""); setRulePattern(""); toast.success("تمت إضافة قاعدة AutoMod"); }, onError: error => toast.error(error.message) });
  const removeRule = trpc.automod.remove.useMutation({ onSuccess: () => void rules.refetch(), onError: error => toast.error(error.message) });

  if (!guildId || (settings.isLoading && !settings.data)) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  const persist = () => save.mutate({ guildId, guildName, xpEnabled, xpPerMessage, xpCooldownSeconds, xpAnnouncementChannelId: xpAnnouncementChannelId || null, xpLevelUpMessage: xpLevelUpMessage || null, antiSpamEnabled, antiSpamMaxMessages, antiSpamWindowSeconds, antiLinkEnabled, antiBotEnabled, antiRaidEnabled, antiRaidJoinLimit, antiRaidWindowSeconds, autoMuteMinutes, warningExpiryDays, autoKickEnabled, moderatorReportChannelId: moderatorReportChannelId || null, aiEnabled, aiRulesText: aiRulesText || null, aiTranslationEnabled: false, aiTicketSummariesEnabled: false });
  const field = "grid gap-2 text-sm font-medium";
  const control = "h-10 rounded-xl border border-input bg-background/65 px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  const visibleSettings = useMemo(() => new Set(filterCommunitySettingsRows(filter).map(row => row.id)), [filter]);
  const setOpen = (id: SettingsRowId) => (open: boolean) => setOpenSettings(open ? id : null);

  return <div className="grid max-w-6xl gap-5">
    <div className="guardian-surface flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-muted-foreground">SYSTEM SETTINGS</p><h2 className="mt-1 text-lg font-bold">إدارة أنظمة المجتمع</h2></div><label className="relative block sm:w-72"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={filter} onChange={event => setFilter(event.target.value)} placeholder="ابحث: XP، حماية، مساعد…" className="pr-9" /></label></div>
    {visibleSettings.has("xp") ? <SettingsRow title="XP والمستويات والرتب" command="/rank · /xptop" description="اضبط اكتساب النقاط والتهنئة واربط أي مستوى برتبة Discord قابلة للتحكم." icon={<Sparkles className="h-5 w-5 text-emerald-300" />} open={openSettings === "xp"} onOpenChange={setOpen("xp")}>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5"><div><h3 className="text-lg font-bold">تكوين XP</h3><p className="mt-1 text-sm text-muted-foreground">تظهر الصدارة داخل نفس السيرفر فقط.</p></div><Switch checked={xpEnabled} onCheckedChange={setXpEnabled} /></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><label className={field}>XP لكل رسالة<Input type="number" min={1} max={500} value={xpPerMessage} onChange={e => setXpPerMessage(Number(e.target.value))} /></label><label className={field}>فاصل XP بالثواني<Input type="number" min={5} value={xpCooldownSeconds} onChange={e => setXpCooldownSeconds(Number(e.target.value))} /></label><label className={field}>قناة تهنئة المستوى<select className={control} value={xpAnnouncementChannelId} onChange={e => setXpAnnouncementChannelId(e.target.value)}><option value="">نفس قناة العضو</option>{channels.data?.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></label></div>
      <label className={`${field} mt-4`}>رسالة الارتقاء<Textarea value={xpLevelUpMessage} onChange={e => setXpLevelUpMessage(e.target.value)} /><span className="text-xs font-normal text-muted-foreground">المتغيرات: {"{user}"} و{"{level}"} و{"{xp}"}.</span></label>
      <div className="mt-6 rounded-xl border border-border bg-secondary/25 p-4"><div className="flex flex-wrap items-end gap-3"><label className={field}>المستوى<Input type="number" min={1} value={rewardLevel} onChange={e => setRewardLevel(Number(e.target.value))} /></label><label className={`${field} min-w-56 flex-1`}>الرتبة<select className={control} value={rewardRoleId} onChange={e => setRewardRoleId(e.target.value)}><option value="">اختر رتبة</option>{roles.data?.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}</select></label><Button disabled={!rewardRoleId || saveReward.isPending} onClick={() => saveReward.mutate({ guildId, level: rewardLevel, roleId: rewardRoleId, announce: true })}><Plus className="ml-2 h-4 w-4" />حفظ المكافأة</Button></div><div className="mt-4 grid gap-2">{rewards.data?.length ? rewards.data.map(item => <div className="flex items-center justify-between rounded-lg bg-background/55 px-3 py-2 text-sm" key={item.id}><span>المستوى <strong>{item.level}</strong> → رتبة <code>{item.roleId}</code></span><Button size="icon" variant="ghost" onClick={() => removeReward.mutate({ guildId, id: item.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>) : <p className="text-sm text-muted-foreground">لا توجد رتب مستويات محفوظة بعد.</p>}</div></div>
      <div className="mt-4 rounded-xl border border-border bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">صدارة XP</h3><p className="mt-1 text-xs text-muted-foreground">أعلى 10 أعضاء في هذا السيرفر. الأمر العام: <code>/xptop</code>.</p></div><span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">TOP 10</span></div><div className="mt-3 grid gap-2">{leaderboard.data?.length ? leaderboard.data.map((member, index) => <div key={`${member.memberLabel}-${index}`} className="flex items-center justify-between rounded-lg bg-background/55 px-3 py-2 text-sm"><span><strong>{index + 1}.</strong> {member.memberLabel}</span><span className="text-muted-foreground">المستوى {member.level} · {member.xp.toLocaleString("en-US")} XP</span></div>) : <p className="text-sm text-muted-foreground">لا توجد نقاط XP مسجلة بعد.</p>}</div></div>
    </SettingsRow> : null}
    {visibleSettings.has("safety") ? <SettingsRow title="الحماية التلقائية وAutoMod" command="/warnings · /clean · /lock" description="كل إجراء يسجل في اللوقات؛ اضبط الحدود قبل تفعيل أي عقوبة تلقائية." icon={<ShieldAlert className="h-5 w-5 text-red-300" />} open={openSettings === "safety"} onOpenChange={setOpen("safety")}>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className="flex items-center justify-between rounded-xl border border-border p-3">Anti-Spam<Switch checked={antiSpamEnabled} onCheckedChange={setAntiSpamEnabled} /></label><label className="flex items-center justify-between rounded-xl border border-border p-3">Anti-Link<Switch checked={antiLinkEnabled} onCheckedChange={setAntiLinkEnabled} /></label><label className="flex items-center justify-between rounded-xl border border-border p-3">Anti-Bot<Switch checked={antiBotEnabled} onCheckedChange={setAntiBotEnabled} /></label><label className="flex items-center justify-between rounded-xl border border-border p-3">Anti-Raid<Switch checked={antiRaidEnabled} onCheckedChange={setAntiRaidEnabled} /></label><label className="flex items-center justify-between rounded-xl border border-border p-3">Auto Kick بعد الحد<Switch checked={autoKickEnabled} onCheckedChange={setAutoKickEnabled} /></label><div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-sm"><strong className="text-sky-200">تنظيف آمن يدوي</strong><p className="mt-1 text-xs text-muted-foreground">استخدم <code>/clean</code> لحذف 1–100 رسالة حديثة؛ لا يوجد تنظيف زمني تلقائي حالياً.</p></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><label className={field}>حد رسائل السبام<Input type="number" min={2} value={antiSpamMaxMessages} onChange={e => setAntiSpamMaxMessages(Number(e.target.value))} /></label><label className={field}>نافذة السبام (ث)<Input type="number" min={3} value={antiSpamWindowSeconds} onChange={e => setAntiSpamWindowSeconds(Number(e.target.value))} /></label><label className={field}>مدة Auto Mute (د)<Input type="number" min={1} value={autoMuteMinutes} onChange={e => setAutoMuteMinutes(Number(e.target.value))} /></label><label className={field}>انتهاء التحذير (يوم)<Input type="number" min={1} max={365} value={warningExpiryDays} onChange={e => setWarningExpiryDays(Number(e.target.value))} /><span className="text-xs font-normal text-muted-foreground">بعدها لا يُحسب للتحذير المتدرج.</span></label><label className={field}>حد دخول Anti-Raid<Input type="number" min={2} value={antiRaidJoinLimit} onChange={e => setAntiRaidJoinLimit(Number(e.target.value))} /></label><label className={field}>نافذة Raid (ث)<Input type="number" min={10} value={antiRaidWindowSeconds} onChange={e => setAntiRaidWindowSeconds(Number(e.target.value))} /></label><label className={field}>روم تقرير المشرفين<select className={control} value={moderatorReportChannelId} onChange={e => setModeratorReportChannelId(e.target.value)}><option value="">يستخدم لوقات الإشراف</option>{channels.data?.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></label></div>
      <div className="mt-6 rounded-xl border border-border bg-secondary/25 p-4"><h3 className="font-semibold">قواعد AutoMod المخصصة</h3><div className="mt-3 grid gap-3 md:grid-cols-4"><Input placeholder="اسم القاعدة" value={ruleName} onChange={e => setRuleName(e.target.value)} /><select className={control} value={ruleType} onChange={e => setRuleType(e.target.value as typeof ruleType)}><option value="keyword">كلمة ممنوعة</option><option value="invite">دعوات Discord</option><option value="caps">حروف كبيرة</option><option value="flood">تكرار سريع</option></select><Input placeholder="كلمات مفصولة بفواصل" value={rulePattern} onChange={e => setRulePattern(e.target.value)} /><select className={control} value={ruleAction} onChange={e => setRuleAction(e.target.value as typeof ruleAction)}><option value="delete">حذف</option><option value="warn">تحذير</option><option value="mute">ميوت</option><option value="kick">طرد</option></select></div><Button className="mt-3" disabled={!ruleName || createRule.isPending} onClick={() => createRule.mutate({ guildId, name: ruleName, type: ruleType, pattern: rulePattern || null, action: ruleAction, enabled: true })}><Plus className="ml-2 h-4 w-4" />إضافة قاعدة</Button><div className="mt-4 grid gap-2">{rules.data?.map(rule => <div key={rule.id} className="flex items-center justify-between rounded-lg bg-background/55 px-3 py-2 text-sm"><span><strong>{rule.name}</strong> · {rule.type} · {rule.action}</span><Button size="icon" variant="ghost" onClick={() => removeRule.mutate({ guildId, id: rule.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div></div>
    </SettingsRow> : null}
    {visibleSettings.has("assistant") ? <SettingsRow title="المساعد المحلي النصي" command="/help · /faq · /complaint · /eventidea" description="مجاني ومحدود: يشرح المعرفة المعتمدة ويصيغ قوالب فقط، ولا ينفذ أي إجراء إداري." icon={<BrainCircuit className="h-5 w-5 text-violet-300" />} open={openSettings === "assistant"} onOpenChange={setOpen("assistant")}><div className="flex items-start justify-between gap-4 border-b border-border pb-5"><div><h3 className="text-lg font-bold">حدود المساعد المحلي</h3><p className="mt-1 text-sm text-muted-foreground">لا يستعمل خدمة خارجية ولا يحتفظ بأسئلة الأعضاء.</p></div><Switch checked={aiEnabled} onCheckedChange={setAiEnabled} /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-black/10 p-3 text-sm text-muted-foreground"><strong className="text-foreground">الترجمة التلقائية</strong><p className="mt-1">غير متاحة في الوضع المحلي المجاني؛ لا ترسل الرسائل لخدمة خارجية.</p></div><div className="rounded-xl border border-border bg-black/10 p-3 text-sm text-muted-foreground"><strong className="text-foreground">تلخيص التذاكر</strong><p className="mt-1">غير متاح تلقائياً لحماية الخصوصية؛ استخدم ملخصاً يكتبه المشرف يدوياً عند الحاجة.</p></div></div><label className={`${field} mt-5`}>ملاحظات وسياسات محلية اختيارية<Textarea className="min-h-44" value={aiRulesText} onChange={e => setAiRulesText(e.target.value)} placeholder="ضع سياسات أو معلومات توافق على استخدامها داخل الردود المحلية." /><span className="text-xs font-normal text-muted-foreground">لا تحفظ رسائل الأعضاء العامة في هذه الخانة. أضف القوانين والأسئلة القابلة للبحث في بطاقة المعرفة بالأسفل.</span></label></SettingsRow> : null}
    {visibleSettings.has("knowledge") ? <SettingsRow title="المعرفة المعتمدة" command="/help · /faq" description="القوانين والأسئلة الشائعة الوحيدة التي يمكن للمساعد المحلي استخدامها في الرد." icon={<BrainCircuit className="h-5 w-5 text-sky-300" />} open={openSettings === "knowledge"} onOpenChange={setOpen("knowledge")}><CommunityKnowledge guildId={guildId} embedded /></SettingsRow> : null}
    {!visibleSettings.size ? <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">لا توجد إعدادات مطابقة لعبارة البحث.</div> : null}
    <div className="flex justify-end"><Button size="lg" disabled={save.isPending} onClick={persist}><Save className="ml-2 h-4 w-4" />حفظ كل الإعدادات</Button></div>
  </div>;
}
