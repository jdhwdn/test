import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { VoiceReadinessCards } from "./VoiceReadinessCards";
import { Loader2, LockKeyhole, Save, ShieldAlert, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const COMMANDS = [
  { key: "ban", label: "/ban", detail: "حظر الأعضاء" },
  { key: "kick", label: "/kick", detail: "طرد الأعضاء" },
  { key: "mute", label: "/mute", detail: "كتم العضو صوتياً" },
  { key: "unmute", label: "/unmute", detail: "إلغاء الكتم" },
  { key: "deafen", label: "/deafen", detail: "تعطيل سماع العضو" },
  { key: "undeafen", label: "/undeafen", detail: "إلغاء تعطيل السمع" },
  { key: "warn", label: "/warn", detail: "تسجيل تحذير" },
  { key: "jail", label: "/jail", detail: "سجن وحفظ الرتب" },
  { key: "unjail", label: "/unjail", detail: "فك السجن بالأمر" },
  { key: "release_jail", label: "زر فك السجن", detail: "من بطاقة روم السجن" },
  { key: "xp", label: "/xp", detail: "إدارة خبرة الأعضاء" },
  { key: "join", label: "/join", detail: "إدخال البوت إلى رومك الصوتي" },
  { key: "leave", label: "/leave", detail: "إخراج البوت من الروم الصوتي" },
  { key: "say", label: "/say", detail: "نطق رسالة مستقلة في الروم الصوتي" },
  { key: "guard_bypass", label: "تجاوز الحماية", detail: "استثناء موثوق من حارس السيرفر" },
] as const;

export default function SecuritySettings({ guildId, guildName }: { guildId: string; guildName: string }) {
  const settings = trpc.settings.get.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const channels = trpc.dashboard.channels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const voiceChannels = trpc.dashboard.voiceChannels.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const roles = trpc.dashboard.roles.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const permissions = trpc.permissions.list.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const blacklist = trpc.blacklist.list.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const voiceStatus = trpc.dashboard.status.useQuery(undefined, { refetchInterval: 30_000 });
  const [jailRoleId, setJailRoleId] = useState("");
  const [jailChannelId, setJailChannelId] = useState("");
  const [voiceConversationChannelId, setVoiceConversationChannelId] = useState("");
  const [voiceConversationRoleId, setVoiceConversationRoleId] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [warningLimit, setWarningLimit] = useState(3);
  const [guardEnabled, setGuardEnabled] = useState(true);
  const [guardWindow, setGuardWindow] = useState(60);
  const [maxRoles, setMaxRoles] = useState(3);
  const [maxChannels, setMaxChannels] = useState(3);
  const [maxBans, setMaxBans] = useState(3);
  const [blacklistMemberId, setBlacklistMemberId] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setJailRoleId(settings.data.jailRoleId ?? "");
    setJailChannelId(settings.data.jailChannelId ?? "");
    setVoiceConversationChannelId(settings.data.voiceConversationChannelId ?? "");
    setVoiceConversationRoleId(settings.data.voiceConversationRoleId ?? "");
    setDashboardUrl(settings.data.dashboardUrl ?? "");
    setWarningLimit(settings.data.warningLimit);
    setGuardEnabled(settings.data.guardEnabled);
    setGuardWindow(settings.data.guardWindowSeconds);
    setMaxRoles(settings.data.guardMaxRoleChanges);
    setMaxChannels(settings.data.guardMaxChannelChanges);
    setMaxBans(settings.data.guardMaxBans);
  }, [settings.data]);

  const saveSettings = trpc.settings.save.useMutation({
    onSuccess: () => { void settings.refetch(); toast.success("تم حفظ إعدادات السجن والحماية"); },
    onError: error => toast.error(error.message),
  });
  const savePermission = trpc.permissions.save.useMutation({
    onSuccess: () => { void permissions.refetch(); toast.success("تم تحديث رتبة الصلاحية"); },
    onError: error => toast.error(error.message),
  });
  const clearPermission = trpc.permissions.clear.useMutation({
    onSuccess: () => { void permissions.refetch(); toast.success("تمت استعادة صلاحية Discord الافتراضية"); },
    onError: error => toast.error(error.message),
  });
  const addBlacklist = trpc.blacklist.add.useMutation({
    onSuccess: result => {
      void blacklist.refetch();
      setBlacklistMemberId("");
      toast.success(result.added ? "تمت إضافة العضو إلى البلاك ليست" : "هذا العضو موجود مسبقاً في البلاك ليست");
    },
    onError: error => toast.error(error.message),
  });
  const removeBlacklist = trpc.blacklist.remove.useMutation({
    onSuccess: () => { void blacklist.refetch(); toast.success("تمت إزالة العضو من البلاك ليست"); },
    onError: error => toast.error(error.message),
  });

  if (!guildId) return <div className="guardian-surface rounded-2xl border border-border p-8 text-center text-muted-foreground">اختر سيرفراً أولاً لتعيين روم السجن والرتب والحماية.</div>;
  if (settings.isLoading || channels.isLoading || voiceChannels.isLoading || roles.isLoading || permissions.isLoading || blacklist.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (settings.isError || blacklist.isError) return <div className="guardian-surface max-w-3xl rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-100"><h2 className="font-bold">تعذر تحميل الإعدادات المحفوظة</h2><p className="mt-2 leading-6">{settings.error?.message ?? blacklist.error?.message ?? "تحقق من DATABASE_URL وترحيلات MySQL في Railway ثم حدّث الصفحة."}</p></div>;

  const selectedRole = (commandKey: (typeof COMMANDS)[number]["key"]) => permissions.data?.find(item => item.commandKey === commandKey)?.roleId ?? "";
  const updatePermission = (commandKey: (typeof COMMANDS)[number]["key"], roleId: string) => {
    if (roleId) savePermission.mutate({ guildId, commandKey, roleId });
    else clearPermission.mutate({ guildId, commandKey });
  };

  return (
    <div className="grid max-w-5xl gap-5">
      <section className="guardian-surface rounded-2xl border border-border p-6">
        <div className="flex items-start gap-3 border-b border-border pb-5"><LockKeyhole className="mt-0.5 h-5 w-5 text-red-300" /><div><h2 className="font-bold">السجن واستعادة الرتب</h2><p className="mt-1 text-sm text-muted-foreground">عند السجن يحفظ البوت الرتب، يزيل كل رتبة يستطيع تعديلها، ويمنح رتبة السجن ثم ينشئ زر فك السجن في روم مخصص.</p></div></div>
        <div className="mt-5"><VoiceReadinessCards readiness={voiceStatus.data?.voice} /></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">رتبة السجن
            <select className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" value={jailRoleId} onChange={event => setJailRoleId(event.target.value)}><option value="">اختر رتبة السجن</option>{roles.data?.map(role => <option value={role.id} key={role.id}>{role.name}{role.editable ? "" : " — أعلى من البوت"}</option>)}</select>
          </label>
          <label className="grid gap-2 text-sm font-medium">روم السجن
            <select className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" value={jailChannelId} onChange={event => setJailChannelId(event.target.value)}><option value="">اختر روم السجن</option>{channels.data?.map(channel => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">روم محادثة مجلساوي المخصص
            <select className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" value={voiceConversationChannelId} onChange={event => setVoiceConversationChannelId(event.target.value)}><option value="">لا تفعل الاستماع الصوتي</option>{voiceChannels.data?.map(channel => <option value={channel.id} key={channel.id}>🔊 {channel.name}</option>)}</select>
            <span className="text-xs font-normal text-muted-foreground">تظهر الرومات الصوتية التي يملك مجلساوي فيها View Channel وConnect وSpeak فقط. يحصر الاستماع في روم مخصص؛ ادخل هذا الروم ثم قل «يا مجلساوي» للتحدث معه.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">رتبة الموافقة على المحادثة الصوتية
            <select className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" value={voiceConversationRoleId} onChange={event => setVoiceConversationRoleId(event.target.value)}><option value="">اختر رتبة الموافقة (مطلوبة)</option>{roles.data?.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select>
            <span className="text-xs font-normal text-muted-foreground">لا يشترك مجلساوي بصوت عضو إلا إذا كان في الروم المخصص ويحمل هذه الرتبة. امنحها فقط لمن وافق على التحدث معه.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">رابط لوحة التحكم
            <Input type="url" value={dashboardUrl} onChange={event => setDashboardUrl(event.target.value)} placeholder="https://your-project.up.railway.app" className="bg-background/65" />
            <span className="text-xs font-normal text-muted-foreground">سيظهر هذا الرابط في أمر <code className="rounded bg-secondary px-1.5 py-0.5">/dashboard</code> لرتبة إدارة السيرفر.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">حد التحذيرات<input type="number" min={1} max={20} value={warningLimit} onChange={event => setWarningLimit(Number(event.target.value))} className="h-10 rounded-xl border border-input bg-background/65 px-3 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        </div>
      </section>

      <section className="guardian-surface rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" /><div><h2 className="font-bold">حماية السيرفر</h2><p className="mt-1 text-sm text-muted-foreground">يرصد البوت تغييرات الرتب والقنوات والحظر من سجل تدقيق Discord. عند تجاوز الحد، يزيل رتب المنفذ التي يمكنه إدارتها ويسجل حادثة حماية كاملة.</p></div></div><Switch checked={guardEnabled} onCheckedChange={setGuardEnabled} /></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">نافذة القياس (ثانية)<Input type="number" min={10} max={3600} value={guardWindow} onChange={event => setGuardWindow(Number(event.target.value))} className="bg-background/65" /></label>
          <label className="grid gap-2 text-sm font-medium">تغييرات الرتب<Input type="number" min={1} max={100} value={maxRoles} onChange={event => setMaxRoles(Number(event.target.value))} className="bg-background/65" /></label>
          <label className="grid gap-2 text-sm font-medium">تغييرات القنوات<Input type="number" min={1} max={100} value={maxChannels} onChange={event => setMaxChannels(Number(event.target.value))} className="bg-background/65" /></label>
          <label className="grid gap-2 text-sm font-medium">الحظر<Input type="number" min={1} max={100} value={maxBans} onChange={event => setMaxBans(Number(event.target.value))} className="bg-background/65" /></label>
        </div>
      </section>

      <section className="guardian-surface rounded-2xl border border-border p-6">
        <div className="flex items-start gap-3 border-b border-border pb-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-indigo-300" /><div><h2 className="font-bold">صلاحيات الأوامر بالرتب</h2><p className="mt-1 text-sm text-muted-foreground">حدّد رتبة مستقلة لكل وظيفة. عند ترك الاختيار فارغاً يستخدم البوت صلاحية Discord الافتراضية المناسبة للأمر.</p></div></div>
        <div className="mt-5 grid gap-3">{COMMANDS.map(command => <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/25 p-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-center" key={command.key}><div><p className="font-semibold">{command.label}</p><p className="text-sm text-muted-foreground">{command.detail}</p></div><select aria-label={`رتبة ${command.label}`} className="h-10 rounded-xl border border-input bg-background/65 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={selectedRole(command.key)} onChange={event => updatePermission(command.key, event.target.value)} disabled={savePermission.isPending || clearPermission.isPending}><option value="">استخدم صلاحية Discord الافتراضية</option>{roles.data?.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select></div>)}</div>
      </section>

      <section className="guardian-surface rounded-2xl border border-border p-6">
        <div className="flex items-start gap-3 border-b border-border pb-5"><UserMinus className="mt-0.5 h-5 w-5 text-rose-300" /><div><h2 className="font-bold">بلاك ليست مجلساوي</h2><p className="mt-1 text-sm text-muted-foreground">ألصق Discord User ID للعضو. لن يرد مجلساوي على هذا العضو، ولن ينفذ له أوامر الصوت أو التفاعل الموجّه للبوت.</p></div></div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Input value={blacklistMemberId} onChange={event => setBlacklistMemberId(event.target.value.replace(/\s/g, ""))} inputMode="numeric" placeholder="Discord User ID — 17 إلى 20 رقماً" className="bg-background/65" /><Button onClick={() => addBlacklist.mutate({ guildId, memberId: blacklistMemberId })} disabled={addBlacklist.isPending || !/^\d{17,20}$/.test(blacklistMemberId)}><UserMinus className="ml-2 h-4 w-4" />إضافة للبلاك ليست</Button></div>
        <p className="mt-2 text-xs text-muted-foreground">من Discord فعّل Developer Mode، ثم اضغط بزر الفأرة الأيمن على العضو واختر Copy User ID.</p>
        <div className="mt-5 grid gap-2">{blacklist.data?.length ? blacklist.data.map(entry => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/25 px-3 py-2.5"><code className="min-w-0 truncate text-sm text-secondary-foreground">{entry.memberId}</code><Button variant="ghost" size="sm" className="shrink-0 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" onClick={() => removeBlacklist.mutate({ guildId, memberId: entry.memberId })} disabled={removeBlacklist.isPending}><Trash2 className="ml-1.5 h-4 w-4" />إزالة</Button></div>) : <p className="rounded-xl bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">لا يوجد أعضاء في البلاك ليست حالياً.</p>}</div>
      </section>

      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5 text-sm">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" /><div><h2 className="font-bold text-emerald-100">حدود الذكاء الاصطناعي الآمنة</h2><p className="mt-1 leading-6 text-muted-foreground">لا يمكن للذكاء الاصطناعي حذف روم أو رتبة، تخريب السيرفر، الطرد، الحظر، أو تعديل أي إعداد إداري. حتى لو طلب المستخدم ذلك، يرفض البوت الطلب قبل التنفيذ ويسجّل الرفض. الأفعال الوحيدة المسموح بها هي الميوت، فك الميوت، الديفن، فك الديفن، والنقل الصوتي بعد التحقق المنظم من العضو والقناة.</p></div></div>
      </section>

      <div className="flex justify-end"><Button disabled={saveSettings.isPending} onClick={() => saveSettings.mutate({ guildId, guildName, jailRoleId: jailRoleId || null, jailChannelId: jailChannelId || null, voiceConversationChannelId: voiceConversationChannelId || null, voiceConversationRoleId: voiceConversationRoleId || null, dashboardUrl: dashboardUrl || null, warningLimit, guardEnabled, guardWindowSeconds: guardWindow, guardMaxRoleChanges: maxRoles, guardMaxChannelChanges: maxChannels, guardMaxBans: maxBans })}><Save className="ml-2 h-4 w-4" />حفظ السجن والحماية</Button></div>
    </div>
  );
}
