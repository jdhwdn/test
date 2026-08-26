import { AttachmentBuilder } from "discord.js";
import { createWelcomeCard, type WelcomeCardInput } from "./welcomeCard";

type WelcomeSendPayload = {
  content: string;
  files?: AttachmentBuilder[];
  allowedMentions: { users: string[] };
};

type WelcomeDeliveryInput = {
  memberId: string;
  fallbackContent: string;
  card: WelcomeCardInput;
  send: (payload: WelcomeSendPayload) => Promise<unknown>;
  renderCard?: (input: WelcomeCardInput) => Promise<Buffer>;
};

export async function deliverWelcomeCard(input: WelcomeDeliveryInput) {
  try {
    const renderCard = input.renderCard ?? createWelcomeCard;
    const image = await renderCard(input.card);
    await input.send({
      content: `مرحباً <@${input.memberId}>`,
      files: [new AttachmentBuilder(image, { name: `welcome-${input.memberId}.png` })],
      allowedMentions: { users: [input.memberId] },
    });
    return "Dynamic welcome card";
  } catch {
    await input.send({ content: input.fallbackContent, allowedMentions: { users: [input.memberId] } });
    return "Text fallback after card-render error";
  }
}
