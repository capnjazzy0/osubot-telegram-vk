import { Command } from "../../Command";
import UnifiedMessageContext from "../../../TelegramSupport";
import { SimpleCommandsModule } from "./index";
import axios from "axios";

export class City extends Command {
    constructor(module: SimpleCommandsModule) {
        super(["city"], module, async (ctx: UnifiedMessageContext) => {
            const text = ctx.messagePayload ?? ctx.text;
            const city = text.replace(/^!+\S+\s*/, "").trim();

            if (!city) {
                const settings = await ctx.userSettings();
                if (settings?.default_city) {
                    await ctx.reply(ctx.tr("city-current", { city: settings.default_city }));
                } else {
                    await ctx.reply(ctx.tr("city-none"));
                }
                return;
            }

            try {
                const geo = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
                    params: { name: city, count: 5, language: "ru", format: "json" },
                });

                const geoData = geo.data;
                if (!geoData.results?.length) {
                    await ctx.reply(ctx.tr("weather-city-not-found", { city }));
                    return;
                }

                const cityName = geoData.results[0].name;
                const settings = await ctx.userSettings();
                settings.default_city = cityName;
                await ctx.updateUserSettings(settings);
                await ctx.reply(ctx.tr("city-set", { city: cityName }));
            } catch (e) {
                global.logger.error("City geocoding error:", e);
                await ctx.reply(ctx.tr("weather-error"));
            }
        });
    }

    check(name: string, ctx: UnifiedMessageContext): boolean {
        const text = ctx.messagePayload ?? ctx.text;
        if (!text) return false;
        return /^!(?:city|город)(?:\s|$)/i.test(text.trim());
    }

    getSplittedText(text: string): string[] {
        return text.replace(/^!+\S+\s*/, "").split(/\s+/).filter(Boolean);
    }
}
