import { AudioLines, MessageCircleWarning } from "lucide-react";
import React from "react";

export type VoiceReadiness = {
  sayReady: boolean;
  conversationReady: boolean;
};

export function VoiceReadinessCards({ readiness }: { readiness?: VoiceReadiness }) {
  const sayReady = Boolean(readiness?.sayReady);
  const conversationReady = Boolean(readiness?.conversationReady);
  return <section className="grid gap-3 rounded-2xl border border-border bg-secondary/20 p-4 sm:grid-cols-2" aria-label="جاهزية الصوت">
    <article data-testid="say-readiness" className="rounded-xl border border-border/70 bg-background/35 p-3"><div className="flex items-center gap-2"><AudioLines className={sayReady ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-amber-300"} /><strong className="text-sm">نطق /say</strong></div><p className="mt-2 text-sm text-muted-foreground">{sayReady ? "جاهز للنطق بالصوت المستقل." : "ينقص ELEVENLABS_VOICE_ID في Railway."}</p></article>
    <article data-testid="conversation-readiness" className="rounded-xl border border-border/70 bg-background/35 p-3"><div className="flex items-center gap-2"><MessageCircleWarning className={conversationReady ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-amber-300"} /><strong className="text-sm">سوالف الروم</strong></div><p className="mt-2 text-sm text-muted-foreground">{conversationReady ? "جاهزة في الروم المخصص ورتبة الموافقة." : "ينقص Voice ID أو Agent ID في Railway."}</p></article>
  </section>;
}
