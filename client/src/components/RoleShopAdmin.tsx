import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BadgeDollarSign, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RoleShopAdmin({ guildId }: { guildId: string }) {
  const roles = trpc.dashboard.roles.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const items = trpc.community.roleShop.useQuery({ guildId }, { enabled: Boolean(guildId) });
  const [roleId, setRoleId] = useState(""); const [cost, setCost] = useState(100); const [enabled, setEnabled] = useState(true);
  const save = trpc.community.saveRoleShopItem.useMutation({ onSuccess: () => { void items.refetch(); setRoleId(""); toast.success("تم حفظ عنصر متجر الرتب"); }, onError: error => toast.error(error.message) });
  const selected = roles.data?.find(role => role.id === roleId);
  if (!guildId) return null;
  return <article className="guardian-surface rounded-2xl border border-border p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><BadgeDollarSign className="h-5 w-5" /></div><div><p className="text-xs font-bold tracking-[0.14em] text-amber-300">ROLE SHOP</p><h2 className="mt-1 text-lg font-bold">متجر رتب المجتمع</h2><p className="mt-1 text-sm text-muted-foreground">أضف رتباً آمنة ليشتريها الأعضاء عبر `/shop` ثم `/buyrole`.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="grid gap-2 text-sm font-medium md:col-span-2">الرتبة<select className="h-10 rounded-xl border border-input bg-background/65 px-3 text-sm" value={roleId} onChange={event => setRoleId(event.target.value)}><option value="">اختر رتبة</option>{roles.data?.map(role => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">التكلفة<Input type="number" min={1} max={1000000} value={cost} onChange={event => setCost(Number(event.target.value))} /></label></div><label className="mt-3 flex items-center justify-between rounded-xl border border-border p-3 text-sm">متاح للشراء<Switch checked={enabled} onCheckedChange={setEnabled} /></label><div className="mt-3 flex justify-end"><Button disabled={!selected || cost < 1 || save.isPending} onClick={() => selected && save.mutate({ guildId, roleId: selected.id, name: selected.name, cost, enabled })}><Plus className="ml-2 h-4 w-4" />حفظ العنصر</Button></div><div className="mt-4 grid gap-2">{items.data?.map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm"><span><strong>#{item.id}</strong> · {item.name} · <span className="text-amber-200">{item.cost} رصيد</span></span><span className={item.enabled ? "rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200" : "rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"}>{item.enabled ? "متاح" : "موقوف"}</span></div>)}{items.data?.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">لا توجد رتب في المتجر بعد.</p> : null}</div></article>;
}
