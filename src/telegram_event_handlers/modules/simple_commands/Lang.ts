import { Command } from "../../Command";
import UnifiedMessageContext from "../../../TelegramSupport";
import { SimpleCommandsModule } from "./index";
import { Language } from "../../../data/Models/Settings/SettingsTypes";

const VALID_LANGS: Language[] = ["ru", "en", "zh"];

export class Lang extends Command {
    constructor(module: SimpleCommandsModule) {
        super(["lang"], module, async (ctx: UnifiedMessageContext) => {
            const text = ctx.messagePayload ?? ctx.text;
            const arg = text.replace(/^!+\S+\s*/, "").trim().toLowerCase();

            if (!arg || !(VALID_LANGS.includes(arg as Language) || arg === "auto")) {
                await ctx.reply(ctx.tr("lang-usage"));
                return;
            }

            const settings = await ctx.userSettings();
            settings.language_override = arg === "auto" ? "do_not_override" : (arg as Language);
            await ctx.updateUserSettings(settings);
            await ctx.reactivateLocalisator();

            const langLabel: Record<string, string> = {
                ru: "🇷🇺 Русский",
                en: "🇺🇸 English",
                zh: "🇨🇳 简体中文",
                auto: "🌐 Auto",
            };
            await ctx.reply(ctx.tr("lang-set", { lang: langLabel[arg] ?? arg }));
        });
    }

    check(name: string, ctx: UnifiedMessageContext): boolean {
        const text = ctx.messagePayload ?? ctx.text;
        if (!text) return false;
        return /^!(?:lang|язык)(?:\s|$)/i.test(text.trim());
    }

    getSplittedText(text: string): string[] {
        return text.replace(/^!+\S+\s*/, "").split(/\s+/).filter(Boolean);
    }
}
