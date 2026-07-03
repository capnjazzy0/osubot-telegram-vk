import { Logger, ILogObj } from "tslog";
import { Bot, IBotConfig } from "./src/Bot";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const config: IBotConfig = {
    vk: {
        token: process.env.VK_TOKEN,
        groupId: Number(process.env.VK_GROUP_ID) || 0,
        owner: Number(process.env.VK_OWNER_ID) || 0,
    },
    tokens: {
        bancho_v2_app_id: Number(process.env.OSU_V2_APP_ID),
        bancho_v2_secret: process.env.OSU_V2_CLIENT_SECRET,
    },
};

declare global {
    interface Global {
        logger: Logger<ILogObj>;
    }
}

const errorLogStream = fs.createWriteStream("log.txt", { flags: "a" });

global.logger = new Logger<ILogObj>({
    attachedTransports: [
        (logObj) => {
            const obj = logObj as unknown as Record<string, unknown>;
            if (typeof obj._logLevelId === "number" && obj._logLevelId >= 5) {
                const msg = String(obj[0] ?? "");
                const meta = obj[1];
                const stack = meta && typeof meta === "object" ? String((meta as Record<string, unknown>).stack ?? "") : "";
                const date = obj._date instanceof Date ? obj._date : new Date();
                errorLogStream.write(
                    `[${date.toISOString()}] [${String(obj._logLevelName)}] ${msg}\n${stack ? stack + "\n" : ""}`
                );
            }
        },
    ],
});

global.logger.info("Starting...");
const bot: Bot = new Bot(config);

bot.start();
