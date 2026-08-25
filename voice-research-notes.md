# Voice conversation implementation notes

- The `@discordjs/voice` `VoiceReceiver` exposes a `subscribe(userId)` method that returns a readable stream of received Opus packets. Source: https://discord.js.org/docs/packages/voice/main/VoiceReceiver:Class
- The discord.js voice guide documents receiving audio and indicates that an Opus stream can be decoded to PCM for downstream audio processing. Source: https://master--discordjs-guide.netlify.app/voice/receiving-audio.html
- ElevenLabs supports Arabic text-to-speech and Opus output at 48kHz, which is compatible with the existing output pipeline. Source: https://elevenlabs.io/docs/overview/capabilities/text-to-speech

Implementation privacy decision: accept only a short, opt-in utterance after the wake name `مجلساوي`; retain audio only in memory for immediate transcription, do not persist raw audio/transcripts, and log a redacted interaction outcome only.

ElevenLabs provides a server-side conversational-agent WebSocket endpoint at `wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}`. A private agent requires a signed WebSocket URL fetched server-side with the ElevenLabs API key. The connection accepts base64 audio chunks and returns audio chunks, transcript events, and agent-response events. Source: https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets

Implementation decision: use an ElevenAgents agent configured by the server owner instead of exposing an LLM credential in Railway. The Railway deployment must supply `ELEVENLABS_AGENT_ID` in addition to the existing ElevenLabs API key and independent voice ID. The bot will never use transcript text as a Discord command or retain raw audio after streaming it to the agent.
