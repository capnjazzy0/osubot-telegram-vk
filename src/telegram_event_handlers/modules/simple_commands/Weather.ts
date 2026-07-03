import { Command } from "../../Command";
import UnifiedMessageContext from "../../../TelegramSupport";
import { SimpleCommandsModule } from "./index";
import axios from "axios";

const STANDARD_HOURS = [0, 6, 12, 18];

function getNextStandardHours(currentHour: number, dayStr: string): { date: string; hour: number }[] {
    const result: { date: string; hour: number }[] = [];
    const d = new Date(dayStr.slice(0, 10) + "T12:00:00");
    for (let offset = 0; offset < 3; offset++) {
        const base = offset === 0 ? currentHour : -1;
        for (const h of STANDARD_HOURS) {
            if (result.length >= 3) break;
            if (offset === 0 && h <= base) continue;
            const dt = new Date(d);
            dt.setDate(dt.getDate() + offset);
            const ds = dt.toISOString().slice(0, 10);
            result.push({ date: ds, hour: h });
        }
        if (result.length >= 3) break;
    }
    return result.slice(0, 3);
}

export class Weather extends Command {
    constructor(module: SimpleCommandsModule) {
        super(["weather"], module, async (ctx: UnifiedMessageContext) => {
            const text = ctx.messagePayload ?? ctx.text;
            let city = text.replace(/^!+\S+\s*/, "").trim();
            if (!city) {
                const settings = await ctx.userSettings();
                city = settings?.default_city ?? "";
                if (!city) {
                    await ctx.reply(ctx.tr("weather-city-required"));
                    return;
                }
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

                const { latitude: lat, longitude: lon, name: cityName } = geoData.results[0];

                const weather = await axios.get("https://api.open-meteo.com/v1/forecast", {
                    params: {
                        latitude: lat,
                        longitude: lon,
                        current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
                        hourly: "temperature_2m",
                        daily: "temperature_2m_max",
                        forecast_days: 4,
                        timezone: "auto",
                    },
                });

                const w = weather.data;
                const curr = w.current;
                const temp = Math.round(curr.temperature_2m);
                const feels = Math.round(curr.apparent_temperature);
                const humidity = curr.relative_humidity_2m;
                const wind = curr.wind_speed_10m;
                const weatherCode = curr.weather_code;
                const desc = ctx.tr(`wmo-${weatherCode}`);

                const currentHour = parseInt(curr.time.slice(11, 13));
                const nextTimes = getNextStandardHours(currentHour, curr.time);

                const hourlyTimes = w.hourly.time as string[];
                const hourlyTemps = w.hourly.temperature_2m as number[];
                const timeMap = new Map<string, number>();
                for (let i = 0; i < hourlyTimes.length; i++) {
                    timeMap.set(hourlyTimes[i], Math.round(hourlyTemps[i]));
                }

                const hourResults = nextTimes.map(nt => {
                    const key = `${nt.date}T${String(nt.hour).padStart(2, "0")}:00`;
                    return { hour: nt.hour, temp: timeMap.get(key) ?? null };
                });

                const dailyMax = w.daily.temperature_2m_max as number[];

                const reply = ctx.tr("weather-output", {
                    city: cityName,
                    temp: String(temp),
                    feels: String(feels),
                    desc,
                    humidity: String(humidity),
                    wind: String(wind),
                    hour1: String(hourResults[0].hour),
                    temp1: String(hourResults[0].temp ?? "—"),
                    hour2: String(hourResults[1].hour),
                    temp2: String(hourResults[1].temp ?? "—"),
                    hour3: String(hourResults[2].hour),
                    temp3: String(hourResults[2].temp ?? "—"),
                    day1: String(Math.round(dailyMax[1])),
                    day2: String(Math.round(dailyMax[2])),
                    day3: String(Math.round(dailyMax[3])),
                });

                await ctx.reply(reply);
            } catch (e) {
                global.logger.error("Weather API error:", e);
                await ctx.reply(ctx.tr("weather-error"));
            }
        });
    }

    check(name: string, ctx: UnifiedMessageContext): boolean {
        const text = ctx.messagePayload ?? ctx.text;
        if (!text) return false;
        return /^!(?:weather|погода)(?:\s|$)/i.test(text.trim());
    }

    getSplittedText(text: string): string[] {
        return text.replace(/^!+\S+\s*/, "").split(/\s+/).filter(Boolean);
    }
}
