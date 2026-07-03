import { Command } from "../../Command";
import UnifiedMessageContext from "../../../TelegramSupport";
import { SimpleCommandsModule } from "./index";

export class Roll extends Command {
    constructor(module: SimpleCommandsModule) {
        super(["roll"], module, async (ctx: UnifiedMessageContext) => {
            const text = ctx.messagePayload ?? ctx.text;
            const rest = text.replace(/^!+\S+\s*/, "").trim();
            const tokens = rest.split(/\s+/).filter(Boolean);
            const first = Number(tokens[0]);
            const max = Number.isFinite(first) && first >= 0 ? Math.max(Math.floor(first), 1) : 100;
            const msg = Number.isFinite(first) ? tokens.slice(1).join(" ") : rest;
            let result: number;
            do { result = Math.floor(Math.random() * (max + 1)); } while (result === 727);
            await ctx.reply(msg ? `${msg}: ${result}` : String(result));
        });
    }

    check(name: string, ctx: UnifiedMessageContext): boolean {
        const text = ctx.messagePayload ?? ctx.text;
        if (!text) return false;
        return /^!(?:roll|ролл)(?:\s|$)/i.test(text.trim());
    }

    getSplittedText(text: string): string[] {
        return text.split(/\s+/).slice(1);
    }
}
