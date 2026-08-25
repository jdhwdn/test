import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  NoSubscriberBehavior,
  StreamType,
  type VoiceConnection,
} from "@discordjs/voice";
import { Readable } from "node:stream";

const MAX_TTS_CHARS = 280;
const MIN_TTS_INTERVAL_MS = 3_000;
const lastSpeechAt = new Map<string, number>();
const players = new Map<string, ReturnType<typeof createAudioPlayer>>();
const audioQueues = new Map<string, Buffer[]>();

export function normalizeTtsText(value: string) {
  const text = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 1) throw new Error("اكتب نصاً قابلاً للنطق بعد الأمر /say.");
  if (text.length > MAX_TTS_CHARS) throw new Error(`نص /say طويل؛ الحد الأقصى ${MAX_TTS_CHARS} حرفاً.`);
  return text;
}

export function canStartTts(guildId: string, now = Date.now()) {
  const last = lastSpeechAt.get(guildId) ?? 0;
  return now - last >= MIN_TTS_INTERVAL_MS;
}

export function markTtsStarted(guildId: string, now = Date.now()) {
  lastSpeechAt.set(guildId, now);
}

export function canUsePlaybackState(status: AudioPlayerStatus) {
  return status !== AudioPlayerStatus.Playing && status !== AudioPlayerStatus.Buffering;
}

function selectedVoiceId() {
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!voiceId) {
    throw new Error("لم يتم ضبط ELEVENLABS_VOICE_ID. اختر صوتاً عربياً مستقلاً من ElevenLabs وأضف معرّفه في متغيرات Railway.");
  }
  return voiceId;
}

export function getVoiceFeatureReadiness() {
  const apiKeyConfigured = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const voiceIdConfigured = Boolean(process.env.ELEVENLABS_VOICE_ID?.trim());
  const agentIdConfigured = Boolean(process.env.ELEVENLABS_AGENT_ID?.trim());
  return {
    apiKeyConfigured,
    voiceIdConfigured,
    agentIdConfigured,
    sayReady: apiKeyConfigured && voiceIdConfigured,
    conversationReady: apiKeyConfigured && voiceIdConfigured && agentIdConfigured,
  };
}

export async function generateIndependentArabicSpeech(text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("مفتاح ElevenLabs غير مضبوط على الخادم.");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoiceId())}?output_format=opus_48000_64`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: normalizeTtsText(text),
      model_id: "eleven_multilingual_v2",
      language_code: "ar",
      voice_settings: { stability: 0.55, similarity_boost: 0.65, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!response.ok) throw new Error(`تعذر إنشاء الصوت من ElevenLabs (الحالة ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("خدمة الصوت أعادت ملفاً فارغاً.");
  return bytes;
}

function playerForGuild(guildId: string) {
  const current = players.get(guildId);
  if (current) return current;
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  player.on(AudioPlayerStatus.Idle, () => {
    const queue = audioQueues.get(guildId);
    const nextAudio = queue?.shift();
    if (!nextAudio) return;
    player.play(createAudioResource(Readable.from(nextAudio), { inputType: StreamType.OggOpus }));
  });
  players.set(guildId, player);
  return player;
}

export async function playIndependentSpeech(input: { guildId: string; connection: VoiceConnection; text: string }) {
  if (!canStartTts(input.guildId)) throw new Error("انتظر ثلاث ثوانٍ قبل طلب نطق جديد.");
  const player = playerForGuild(input.guildId);
  const audio = await generateIndependentArabicSpeech(input.text);
  input.connection.subscribe(player);
  const queued = !canUsePlaybackState(player.state.status);
  if (queued) {
    const queue = audioQueues.get(input.guildId) ?? [];
    if (queue.length >= 2) throw new Error("طابور النطق ممتلئ؛ انتظر حتى ينتهي البوت من المقاطع الحالية.");
    queue.push(audio);
    audioQueues.set(input.guildId, queue);
  } else {
    player.play(createAudioResource(Readable.from(audio), { inputType: StreamType.OggOpus }));
    await entersState(player, AudioPlayerStatus.Playing, 10_000);
  }
  markTtsStarted(input.guildId);
  return { characters: normalizeTtsText(input.text).length, queued };
}

export const TTS_LIMITS = { MAX_TTS_CHARS, MIN_TTS_INTERVAL_MS };
