# مجلساوي

**مجلساوي** بوت Discord ولوحة تحكم تركّزان على الإشراف القابل للمراجعة ولوقات Discord Embed المفصلة حسب الحدث. يمكن لكل سيرفر توجيه الإشراف والصوت والأعضاء والرتب والقنوات والرسائل وXP والترحيب و**تفاعلات البوت** والنظام إلى قناة مستقلة. تتيح اللوحة المظلمة ضبط اللوقات، مراجعة النشاط، إعداد الترحيب، السجن والحماية، والبلاك ليست.

## What has been implemented

| Area | Included behaviour |
| --- | --- |
| Professional logs | Each entry is a Discord Embed with a category colour, icon, title, executor, affected member/item, reason, event key, timestamp, IDs, and applicable before/after fields. |
| Moderation | Slash commands for `/ban`, `/kick`, `/mute`, `/unmute`, `/deafen`, `/undeafen`, `/warn`, `/jail`, `/unjail`, and `/xp`, with persistent activity records. |
| Jail workflow | `/jail` stores the member’s role snapshot, removes all roles the bot can manage, grants the configured jail role, and posts a case Embed with a **فك السجن** button in the configured jail channel. The release action removes the jail role and restores eligible saved roles exactly once. |
| Role-based access | Every moderation command, the release button, and the protection bypass can be assigned an independent Discord role. An unassigned item falls back to its native Discord permission. |
| Server guard | Configurable rolling limits for role changes, channel changes, and bans. When a non-exempt actor exceeds a limit, the bot strips the actor’s manageable roles and creates a high-priority protection log. |
| Voice | Member joins, leaves, moves, and administrative server mute/deafen changes. Authorized members can use `/join` and `/leave`; `/say` produces short independent Arabic speech, while the optional voice conversation responds only after the wake name **مجلساوي**. |
| Bot interactions | A separate **تفاعلات البوت** route records slash commands, dashboard-link requests, directed messages, safety decisions, buttons, and bot actions. It stores no raw directed-message text, general conversation, or voice audio. |
| Server changes | Member lifecycle, role, channel, and message create/update/delete-relevant events, including prior and new values where available. |
| Control panel | Authenticated dark dashboard with connected status, current activity, independent per-category channel routing, welcome settings, and moderation settings. `/dashboard` and the exact text command `لوحة التحكم` can send an administrator a configured dashboard-link button. |
| Welcome card | New members receive a dynamic PNG welcome card with the server name, their Discord avatar, display name, and configured welcome message; a text-only fallback is delivered if image rendering cannot complete. |

## Discord configuration

Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications). In the bot settings, enable the **Server Members Intent**, **Message Content Intent**, and the capabilities your server policy permits. The bot needs the `DISCORD_BOT_TOKEN` stored as a server-side secret; do not paste this value into the browser or commit it to the repository.

When inviting the bot, grant the permissions that match the features you enable. In addition to Send Messages and Embed Links for log delivery, executor attribution for external administrative actions depends on the **View Audit Log** permission. Discord’s audit-log resource documents that audit entries contain a target, actor, action type, optional reason, and structured changes; it also records that access requires this permission. [Discord Audit Log documentation](https://docs.discord.com/developers/resources/audit-log)

| Feature | Required Discord permissions |
| --- | --- |
| Embed logs | View Channel, Send Messages, Embed Links |
| Audit attribution | View Audit Log |
| Ban and kick commands | Ban Members, Kick Members |
| Voice moderation | Mute Members, Deafen Members, Move Members |
| Bot voice connection and speech | Connect, Speak, and View Channel for the chosen voice room |
| Jail role command | Manage Roles, with the bot role higher than the jail role and every role expected to be removed or restored |
| Channel and role visibility | View Channel; permissions relevant to the audited resources |

## First-use checklist

After the bot is online and present in the server, open the dashboard and select the guild. In **Log routing**, choose the destination Discord text channel for every category you want enabled, including **تفاعلات البوت** if you want a dedicated room for commands and bot actions. A disabled category is not sent to Discord, though implemented event handling remains available for future activation.

In **Moderation and protection**, set the public deployment address in **Dashboard URL**. The bot exposes `/dashboard`, and also recognises the exact text `لوحة التحكم`, for members with the Discord **Manage Server** permission. Both send a card containing a button to that configured URL; the URL is validated before it can be stored or shared.

In **Welcome**, enable the option, select a text channel, and compose a message using `{user}` and `{server}`. مجلساوي converts this into a styled welcome-card image and uses the joining member’s actual Discord avatar; the supplied reference guides the warm premium visual style but is not copied with its brand or portrait. In **Moderation**, select both the jail role and jail channel. The bot must be higher than the jail role and every role it should remove or restore; Discord will not let a bot modify equal or higher roles. Assign the desired role to **/jail** and **زر فك السجن** in the command-permissions list. Leaving a command unset keeps its normal Discord permission as a fallback.

The server guard starts with a sixty-second window and separate limits for role changes, channel changes, and bans. The server owner is always exempt. If a **تجاوز الحماية** role is assigned, members with that role are also exempt; grant it sparingly. When a threshold is exceeded, مجلساوي removes only roles it can manage, never claims to undo already-deleted channels, and sends a protection event to the system log category.

## بلاك ليست مجلساوي

من صفحة **الإشراف والحماية** ألصق Discord User ID (من 17 إلى 20 رقماً) ثم اضغط **إضافة للبلاك ليست**. العضو المحظور لا يتلقى ردوداً من مجلساوي، ولا يمكنه تشغيل `/join` أو `/leave` أو `/say` أو أي أمر Slash آخر، ولا تعالج المحادثة الصوتية نداءه. تعمل البلاك ليست بصورة مستقلة لكل سيرفر؛ لذلك لا تؤثر في السيرفرات الأخرى. تسجل عمليات الإضافة والإزالة في فئة **تفاعلات البوت** من دون تسجيل محادثات عامة أو صوت خام.

## الصوت المستقل ومحادثة الروم

يعمل `/join` فقط لمن لديه الرتبة المضبوطة أو صلاحية Discord الافتراضية المناسبة وكان داخل روم صوتي. ينضم مجلساوي من دون صمم ذاتي لكي يستطيع استقبال النداء الموجّه له. بعد أن يكون المستخدم والبوت في نفس الروم، يستطيع الدور المخوّل تنفيذ `/say text:...`؛ يقتصر النص على 280 حرفاً ويوجد فاصل قصير بين الطلبات. لا يظهر النص الخام في اللوقات.

النطق يستخدم ElevenLabs بصوت **مستقل** تختاره أنت بمعرّف `ELEVENLABS_VOICE_ID`. لا يستخدم المشروع أو يحتفظ أو يحلل المقطع المرجعي المرفوع، ولا ينشئ نسخة من صوت أي شخص. لا يمكن ضمان لهجة قصيم مطابقة؛ اختر صوتاً عربياً/سعودياً مستقلاً من مكتبة ElevenLabs ثم جرّب جُملاً قصيرة. تدعم خدمة ElevenLabs العربية وصيغة Opus ذات 48kHz، وهي الصيغة التي يطلبها البوت لتشغيلها مباشرة عبر Discord. [4]

للسوالف الطبيعية، أنشئ **Agent** خاصاً باسم مجلساوي في ElevenLabs Agents، واضبط شخصيته العربية، ثم أضف معرّفه إلى `ELEVENLABS_AGENT_ID`. من لوحة **الإشراف والحماية** اختر روم **محادثة مجلساوي المخصص** ورتبة **الموافقة على المحادثة الصوتية**. لا يبدأ البوت الاستماع في أي روم آخر، ولا يشترك بصوت عضو لا يحمل رتبة الموافقة، حتى لا يُرسل صوت الرومات العامة أو غير الموافقين للتحويل. عند دخول الروم المخصص، يعالج مجلساوي فقط الجمل التي تناديه باسمه، ثم يحذف الصوت والنص المؤقتين من ذاكرة العملية بعد التحويل. لا تحفظ قاعدة البيانات النص أو الصوت، ولا تسجل قناة **تفاعلات البوت** سوى أن الرد بدأ أو فشل. لا يحوّل هذا المسار الكلام إلى أوامر إدارية أو تخريبية.

## حدود الذكاء الاصطناعي

تنفذ طبقة الذكاء الاصطناعي في هذا المشروع **أفعال الصوت الآمنة فقط**: الميوت، فك الميوت، الديفن، فك الديفن، ونقل عضو إلى قناة صوتية محددة. قبل التنفيذ تمر أي نتيجة من الذكاء الاصطناعي عبر قائمة سماح حتمية؛ لا يمكن تحويل أي مخرج لغوي إلى إجراء تنفيذي إذا لم يكن أحد هذه الأفعال الخمسة وبمعرّف عضو صالح، كما يتطلب النقل معرّف قناة وجهة.

كل طلب يذكر الحذف، تخريب السيرفر، طرد عضو، حظره، إدارة الرومات، إدارة الرتب، أو أي تغيير إداري يُرفض قبل التنفيذ حتى لو صاغه المستخدم كتعليمات مباشرة. يسجل البوت قرار الرفض وفئة السياسة في لوق النظام من دون الاحتفاظ بنص الطلب، لتقليل إمكانية إعادة تشغيل محتوى مؤذٍ من السجل. لا يُضاف أي مسار بديل قادر على تنفيذ تلك الإجراءات عبر الذكاء الاصطناعي.

## Run and verify locally

The project uses Node.js, TypeScript, Discord.js, React, tRPC, and MySQL/TiDB through Drizzle. The automated suite validates the Discord bot token against Discord’s identity endpoint, the Embed structure, invalid log-category rejection, and the existing authentication logout flow.

```bash
pnpm check
pnpm test
pnpm build
```

## تشغيل Railway

يمكن تشغيل العملية الواحدة التي تجمع لوحة التحكم والبوت على Railway، لكن النشر الخارجي يحتاج إعداداً يدوياً وقد لا يتوافق تلقائياً مع متغيرات المنصة المضمنة في بيئة التطوير الحالية. أنشئ خدمة من مستودع GitHub، ثم اجعل أمر البناء `pnpm install --frozen-lockfile && pnpm build` وأمر التشغيل `pnpm start`. الخادم يقرأ `PORT` تلقائياً، وهو المتغير الذي توفره Railway لخدمة Express. [1]

أضف خدمة MySQL إلى مشروع Railway، ثم مرّر رابطها إلى `DATABASE_URL`. تدعم Railway خدمة MySQL ومتغيرات الاتصال الخاصة بها؛ استخدم رابط اتصال MySQL المتوافق مع Drizzle، ولا تستخدم PostgreSQL ما لم تُحوّل مخطط التطبيق. [2] أضف `DISCORD_BOT_TOKEN` في Variables فقط ولا تضعه في المستودع.

| متغير Railway | الغرض |
| --- | --- |
| `DISCORD_BOT_TOKEN` | اتصال البوت بخادم Discord وإرسال اللوقات. |
| `DATABASE_URL` | قاعدة بيانات MySQL المستمرة لإعدادات اللوقات والسجن والصلاحيات. |
| `DASHBOARD_PASSWORD` | كلمة مرور لوحة التحكم؛ استخدم عبارة قوية وفريدة (يوصى بـ14 حرفاً أو أكثر) ولا تحفظها في GitHub. |
| `JWT_SECRET` | سلسلة عشوائية طويلة لتوقيع كوكي جلسة لوحة التحكم. |
| `ELEVENLABS_API_KEY` | مفتاح خادم ElevenLabs فقط لتوليد النطق. |
| `ELEVENLABS_VOICE_ID` | معرّف صوت عربي/سعودي مستقل من ElevenLabs؛ ليس ملفاً صوتياً ولا نسخة صوت. |
| `ELEVENLABS_AGENT_ID` | معرّف Agent خاص بمجلساوي في ElevenLabs لتشغيل المحادثة الصوتية الطبيعية. |
| `NODE_ENV=production` | تشغيل نسخة الإنتاج. |

في Railway، افتح عنوان خدمتك ثم أدخل `DASHBOARD_PASSWORD` في شاشة الدخول. لا يعتمد الإنتاج على بوابة Manus OAuth، لذلك لن يحولك الموقع إلى رابط OAuth خارجي أو يعرض خطأ **Invalid URL**. الجلسة تكون كوكي HTTP-only موقعة، وتستمر 12 ساعة أو حتى تسجيل الخروج.

يفضّل ضبط سياسة إعادة التشغيل إلى **On Failure** على الأقل. تنص وثائق Railway على أن هذا هو الإعداد الافتراضي مع حد عشرة محاولات، بينما سياسة **Always** غير متاحة في الخطة المجانية. [3] راجع سجلات Railway بعد أول نشر، وتأكد أن البوت يظهر Online وأن أوامر Slash ومسارات اللوقات تعمل في السيرفر المستهدف.

## Continuous operation requirement

Discord delivers bot events over its Gateway connection. The bot client therefore has to run in a continuously available server process; request-scoped deployment is unsuitable because it cannot reliably keep that connection open. Use the project’s persistent hosting setting for production bot operation, then publish from the project interface after creating a checkpoint. The dashboard itself may load without a permanent process, but the Discord bot will not stay online without one.

## Implementation notes

Discord’s events and audit-log entry availability can vary by action and timing. The bot logs the Gateway event immediately and attempts to correlate a very recent audit-log entry for the executor and reason when relevant. This means “self” voice changes are not falsely attributed to a moderator, while Discord-supplied administrative information is preserved whenever it is available.

## References

[1] [Railway — Deploy an Express App](https://docs.railway.com/guides/express)

[2] [Railway — MySQL](https://docs.railway.com/databases/mysql)

[3] [Railway — Restart Policy](https://docs.railway.com/deployments/restart-policy)

[4] [ElevenLabs — Text to Speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
