import { Command } from "../../Command";
import UnifiedMessageContext from "../../../TelegramSupport";
import { SimpleCommandsModule } from "./index";

export class Source extends Command {
    constructor(module: SimpleCommandsModule) {
        super(["source"], module, async (ctx: UnifiedMessageContext) => {
            const url = ctx.getPhotoUrl();
            if (!url) {
                await ctx.reply(ctx.tr("source-no-image"));
                return;
            }

            const encoded = encodeURIComponent(url);
            const link = `https://yandex.com/images/search?url=${encoded}&rpt=imageview`;

            await ctx.reply(ctx.tr("source-result", { link }), {
                dont_parse_links: true,
            });
        });
    }

    check(name: string, ctx: UnifiedMessageContext): boolean {
        const text = ctx.messagePayload ?? ctx.text;
        if (!text) return false;
        return /^!(?:source|сурс|соус)(?:\s|$)/i.test(text.trim());
    }

    getSplittedText(text: string): string[] {
        return text.replace(/^!+\S+\s*/, "").split(/\s+/).filter(Boolean);
    }
}
