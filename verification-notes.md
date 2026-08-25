# Verification Notes

## Discord logging design

The logging foundation uses Discord embeds and the server audit-log data model. Administrative audit entries can expose an affected target, executor, action type, optional reason, and structured changes. The bot therefore records those concepts in both its embeds and dashboard activity records. The bot must receive the `View Audit Log` permission to attribute eligible administrative changes to an executor.

## Dashboard visual check

The authenticated preview was reviewed at the overview, logging, moderation, and welcome routes. The pages render as a cohesive dark Discord-inspired dashboard, with clear status cards, empty activity handling, separate configuration rows for each log category, and responsive settings forms. No mock activity events or user-generated reviews were added.

## Persistent operation

The current bot client runs as part of the server process. A production Discord bot needs a persistent process to maintain its Gateway connection; default request-scoped hosting is not appropriate for that requirement.

## Railway deployment research

Railway's Express guidance starts Node services with the package start command and passes the service port through the `PORT` environment variable; the existing server already reads `process.env.PORT`. Railway's current documentation labels its older config-as-code files as deprecated, so project deployment settings should be configured in the Railway service interface instead of adding a new `railway.toml` file. Its restart documentation says the default policy is On Failure with a maximum of ten restarts, while the Always policy is unavailable on the free plan. A Discord bot should therefore use a single Railway service, one replica, the normal build and start commands, and a paid Railway plan if it needs the Always restart policy.

## Jail and protection dashboard visual check

The moderation route was reviewed after the jail-and-protection extension. The page renders a consolidated configuration screen for selecting a jail role and jail channel, warning threshold, rolling protection limits, and individual role assignment for each moderation command, the release button, XP changes, and protection bypass. The interface stays consistent with the existing dark Discord-inspired panel and does not populate fabricated activity data.

## Jail and protection schema verification

After restarting the development server, the database was queried directly. The `guild_settings` table confirmed the `jailChannelId` and `guardEnabled` columns, while the `jail_records` and `command_role_permissions` tables were present. The earlier missing-column console line was emitted before the migration had been applied; the subsequent restart and database inspection confirmed the active schema contains the required jail and protection structures.

## Final security screen verification

The final moderation-screen preview confirms the dark control panel presents the jail-role and jail-channel selectors, warning threshold, enabled protection switch, rolling thresholds, and per-action role selectors in a clear hierarchy. The server reported no TypeScript or current runtime errors during this check.

The moderation screen was rechecked after the Majlsawi rename and blacklist extension. It presents a dedicated **بلاك ليست مجلساوي** card with a Discord User ID field, an add action, and an empty-state list when no members are blocked. The screen retains the existing accessible dark-panel hierarchy and does not introduce fabricated member data.

The overview screen now shows distinct readiness cards for `/say` and voice conversation. The cards explicitly identify a missing Voice ID or Agent ID rather than implying that speech is active. The moderation settings include a dedicated Majlsawi voice-room selector; selecting it is required before any audio is subscribed for transcription.

## AI action-boundary verification

The safety policy was verified with automated tests covering destructive Arabic and English requests, safe voice-intent recognition, action allowlisting, and redacted policy-log details. The moderation-screen preview now presents the same boundary to administrators: AI requests may only lead to voice mute, unmute, deafen, undeafen, or member movement after structured authorization; administrative and destructive requests are rejected before execution.

## Dashboard link and welcome-card verification

The moderation screen displays the dedicated Dashboard URL field alongside jail and protection settings. The welcome screen displays the dynamic-card preview with a warm gold, Arabic-inspired design, member-avatar placeholder, server name, and rendered welcome copy. Automated tests cover the image renderer, PNG attachment delivery payload, and the text-only fallback if image rendering fails.

## Independent Qassim-style TTS reference

The independent text-to-speech integration is designed around ElevenLabs' text-to-speech API rather than uploaded reference audio. The official API accepts a selected `voice_id`, Arabic text, an optional model identifier, and returns an audio file; it also lists Saudi Arabic among supported Arabic locales. The chosen design uses an independently selected or designed voice and does not upload, retain, analyse, or clone the user-supplied reference clip. Source: [ElevenLabs Create Speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) and [ElevenLabs Text to Speech overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech).
