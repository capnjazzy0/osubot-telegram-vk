import { VK, MessageContext, MessageEventContext, Updates } from "vk-io";
import express, { Request, Response } from "express";
import * as promClient from "prom-client";
import { Module } from "./telegram_event_handlers/modules/Module";
import Database from "./data/Database";
import { APICollection } from "./api/APICollection";
import { Templates, ITemplates } from "./telegram_event_handlers/templates";
import Maps from "./Maps";
import Admin from "./telegram_event_handlers/modules/Admin";
import Main from "./telegram_event_handlers/modules/Main";
import Akatsuki from "./telegram_event_handlers/modules/Akatsuki";
import AkatsukiRelax from "./telegram_event_handlers/modules/AkatsukiRelax";
import AkatsukiAutoPilot from "./telegram_event_handlers/modules/AkatsukiAutoPilot";
import Bancho from "./telegram_event_handlers/modules/Bancho";
import Gatari from "./telegram_event_handlers/modules/Gatari";
import Ripple from "./telegram_event_handlers/modules/Ripple";
import BeatLeader from "./telegram_event_handlers/modules/BeatLeader";
import ScoreSaber from "./telegram_event_handlers/modules/ScoreSaber";
import OsuTrackAPI from "./osu_specific/OsuTrackAPI";
import IgnoreList from "./Ignore";
import UnifiedMessageContext from "./TelegramSupport";
import { initI18n } from "./TelegramSupport";
import { OsuBeatmapProvider } from "./beatmaps/osu/OsuBeatmapProvider";
import BanchoAPIV2 from "./api/BanchoV2";
import { SimpleCommandsModule } from "./telegram_event_handlers/modules/simple_commands";
import Util from "./Util";
import { OkiCardsGenerator } from "./oki-cards/OkiCardsGenerator";
import RippleRelax from "./telegram_event_handlers/modules/RippleRelax";
import { setInterval, clearInterval } from "node:timers";
import { PACKAGE_VERSION } from "./version";
import path from "path";
import { ReplyUtils } from "./telegram_event_handlers/utils/ReplyUtils";
import { Command } from "./telegram_event_handlers/Command";

export interface IBotConfig {
    vk: {
        token: string;
        groupId: number;
        owner: number;
    };
    tokens: {
        bancho_v2_app_id: number;
        bancho_v2_secret: string;
    };
}

type ShouldRemoveCallback = boolean;
export type PendingCallback = (ctx: UnifiedMessageContext) => Promise<ShouldRemoveCallback>;

export class Bot {
    public readonly config: IBotConfig;
    public readonly vk: VK;
    public readonly database: Database;
    public readonly api: APICollection;
    public readonly osuBeatmapProvider: OsuBeatmapProvider;
    public readonly templates: ITemplates = Templates;
    public readonly maps: Maps;
    public readonly ignored: IgnoreList;
    public readonly track: OsuTrackAPI;

    public readonly banchoApi: BanchoAPIV2;

    public readonly okiChanCards: OkiCardsGenerator = new OkiCardsGenerator();

    public readonly replyUtils: ReplyUtils;

    private readonly pendingCallbacks: { [id: string]: PendingCallback } = {};

    public modules: Module[] = [];
    public startTime: number = 0;
    private totalMessages: number = 0;
    public me: { id: number; name: string };
    public readonly version: string;

    private readonly useWebhooks = process.env.USE_WEBHOOKS === "true";

    private updates: Updates;
    private expressApp: express;

    private _initializationPromise: Promise<void>;

    constructor(config: IBotConfig) {
        this.config = config;
        global.logger.info("Set owner id: ", config.vk.owner);

        this.vk = new VK({
            token: config.vk.token,
            pollingGroupId: config.vk.groupId,
            apiMode: "sequential",
        });

        this.database = new Database(this.vk, config.vk.owner);
        this.ignored = new IgnoreList(this.database);

        this.banchoApi = new BanchoAPIV2(this);
        this.osuBeatmapProvider = new OsuBeatmapProvider(this.banchoApi, this.database.osuBeatmapMeta);

        this.api = new APICollection(this.banchoApi, this.osuBeatmapProvider);
        this.maps = new Maps();
        this.track = new OsuTrackAPI();

        this.version = PACKAGE_VERSION;

        this.replyUtils = new ReplyUtils(this.okiChanCards, this.templates, this.database.covers);

        this.updates = this.vk.updates;

        this._initializationPromise = this.initialize();
    }

    private buildContext(ctx: MessageContext | MessageEventContext): UnifiedMessageContext {
        return new UnifiedMessageContext(ctx, this.config.vk.owner, this.me, this.vk, this.database);
    }

    private async initialize(): Promise<void> {
        await initI18n(path.join("./src", "locales"));
        await this.setupDatabase();
        this.registerModules();
        this.setupBot();
        this.setupEventHandlers();
    }

    private async setupDatabase(): Promise<void> {
        await this.database.init();
        await this.ignored.init();
    }

    private registerModules(): void {
        this.modules = [
            new Bancho(this),
            new Gatari(this),
            new Ripple(this),
            new RippleRelax(this),
            new Akatsuki(this),
            new AkatsukiRelax(this),
            new AkatsukiAutoPilot(this),
            new BeatLeader(this),
            new ScoreSaber(this),
            new Admin(this),
            new Main(this),
            new SimpleCommandsModule(this),
        ];
    }

    private setupBot(): void {
        const rateLimitMap = new Map<number, number[]>();

        this.updates.on("message", async (messageCtx: MessageContext) => {
            const now = Date.now();
            const window = 5000;
            const limit = 3;

            const timestamps = rateLimitMap.get(messageCtx.senderId) ?? [];
            const recent = timestamps.filter((t) => now - t < window);
            recent.push(now);
            rateLimitMap.set(messageCtx.senderId, recent);

            if (recent.length > limit) {
                const ctx = this.buildContext(messageCtx);
                await ctx.ensureUserInfoUpdated();
                await ctx.activateLocalisator();
                await this.database.statsModel.logMessage(ctx);
                await ctx.reply(ctx.tr("too-fast-commands-text"));
                return;
            }

            try {
                await this.handleMessage(messageCtx);
            } catch (e) {
                global.logger.error("Unhandled message error:", e);
            }
        });
    }

    private setupEventHandlers(): void {
        this.updates.on("message_event", this.handleMessageEvent);

        this.updates.on("message", async (messageCtx: MessageContext) => {
            if (messageCtx.isChat && messageCtx.isEvent) {
                const eventType = messageCtx.eventType;
                const userId = messageCtx.eventMemberId;
                if (!userId) return;

                if (eventType === "chat_invite_user" || eventType === "chat_invite_user_by_link") {
                    const inChat = await this.database.chats.isUserInChat(userId, messageCtx.peerId);
                    if (!inChat) {
                        await this.database.chats.userJoined(userId, messageCtx.peerId);
                    }
                } else if (eventType === "chat_kick_user") {
                    await this.database.chats.userLeft(userId, messageCtx.peerId);
                }
            }
        });
    }

    private handleMessageEvent = async (context: MessageEventContext): Promise<void> => {
        await context.answer({ type: "show_snackbar", text: "" }).catch(() => global.logger.error("Failed to answer message_event"));

        try {
            const ctx = this.buildContext(context);
            await ctx.ensureUserInfoUpdated();
            await this.database.statsModel.logMessage(ctx);
            await this.processCommands(ctx);
        } catch (e) {
            global.logger.error("handleMessageEvent error:", e);
        }
    };

    private readonly okiChanAliases: Record<string, string> = {
        "o!me": "s u",
        "osu!me": "s u",
        "o!get": "s u",
        "osu!get": "s u",
        "o!u": "s u",
        "osu!u": "s u",
        "o!user": "s u",
        "osu!user": "s u",
        "o!best": "s t",
        "osu!best": "s t",
        "o!last": "s r",
        "osu!last": "s r",
        "o!settings": "osu s",
        "osu!settings": "osu s",
        "o!set": "osu s",
        "osu!set": "osu s",
        "o!help": "osu help",
        "osu!help": "osu help",
        "o!link": "s link",
        "osu!link": "s link",
    };

    private commandAliases: Record<string, string> = {
        start: "osu onboarding",
        help: "osu help",
        settings: "osu settings",
        user: "s u",
        recent: "s r",
        top_scores: "s t",
        chat_leaderboard: "s chat -std",
        chat_leaderboard_mania: "s chat -mania",
        chat_leaderboard_taiko: "s chat -taiko",
        chat_leaderboard_fruits: "s chat -ctb",
    };

    private handleMessage = async (context: MessageContext): Promise<void> => {
        if (this.shouldSkipMessage(context)) {
            return;
        }

        const ctx = this.buildContext(context);
        await ctx.ensureUserInfoUpdated();

        ctx.applyTextOverrides(this.commandAliases);

        if (await ctx.checkFeature("plaintext-overrides")) {
            ctx.applyTextOverrides(this.okiChanAliases);
        }

        this.totalMessages++;
        await this.database.statsModel.logMessage(ctx);

        const ticket = this.createCallbackTicket(ctx);
        const cb = this.pendingCallbacks[ticket];
        if (cb) {
            let res: ShouldRemoveCallback = false;
            await ctx.activateLocalisator();
            try {
                res = await cb(ctx);
            } catch (e: unknown) {
                res = true;
                const err = await this.database.errors.addError(ctx, e);

                let errorText: string;
                if (e instanceof Error) {
                    errorText = e.message;
                } else if (e instanceof String) {
                    errorText = String(e);
                }

                await ctx.reply(`${Util.error(errorText, ctx)} (${err})`);
            } finally {
                if (res) {
                    this.removeCallback(ticket);
                }
            }
            return;
        }

        await this.processCommands(ctx);
    };

    private shouldSkipMessage(ctx: MessageContext): boolean {
        if (ctx.senderId < 0) return true;
        return this.ignored.isIgnored(ctx.senderId);
    }

    private async processOnboardings(ctx: UnifiedMessageContext): Promise<boolean> {
        if (!(await ctx.checkFeature("force-onboarding"))) {
            return false;
        }

        if (!(await this.database.onboardingModel.isUserNeedOnboarding(ctx.senderId))) {
            return false;
        }

        let onboardingCommand: Command = undefined;
        for (const module of this.modules) {
            if (module.name != "Main") {
                continue;
            }

            for (const cmd of module.commands) {
                if (cmd.name == "onboarding") {
                    onboardingCommand = cmd;
                    break;
                }
            }
        }

        await onboardingCommand.process(ctx);
        return true;
    }

    private async processCommands(ctx: UnifiedMessageContext): Promise<boolean> {
        for (const module of this.modules) {
            const match = module.checkContext(ctx);
            if (!match) {
                continue;
            }

            if (await this.processOnboardings(ctx)) {
                return;
            }

            if (ctx.isInGroupChat) {
                const inChat = await this.database.chats.isUserInChat(ctx.senderId, ctx.chatId);
                if (!inChat) {
                    await this.database.chats.userJoined(ctx.senderId, ctx.chatId);
                }
            }

            if (match.map) {
                const chatMap = this.maps.getChat(ctx.chatId);
                if (!chatMap || chatMap.map.id !== match.map) {
                    const beatmap = await this.osuBeatmapProvider.getBeatmapById(match.map);
                    this.maps.setMap(ctx.chatId, beatmap);
                }
            }

            await match.command.process(ctx);
            return true;
        }

        return false;
    }

    private initHealthCheck() {
        this.ensureExpressAppCreated();

        this.expressApp.get("/health", (req: Request, res: Response) => {
            const healthStatus = {
                status: "UP",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                message: "Service is running",
            };
            return res.status(200).json(healthStatus);
        });
    }

    private initPrometheusMetrics() {
        this.ensureExpressAppCreated();

        promClient.collectDefaultMetrics();

        this.expressApp.get("/metrics", async (req: Request, res: Response) => {
            try {
                res.setHeader("Content-Type", promClient.register.contentType);
                const metrics = await promClient.register.metrics();
                res.status(200).send(metrics);
            } catch (err) {
                res.status(500).send(err instanceof Error ? err.message : String(err));
            }
        });
    }

    private ensureExpressAppCreated() {
        if (!this.expressApp) {
            this.expressApp = express();
            this.expressApp.use(express.json());
        }
    }

    private listenExpressAppIfNeeded() {
        if (!this.expressApp) {
            return;
        }

        const port = Number(process.env.APP_PORT);
        this.expressApp.listen(port, () => {
            global.logger.info(`Listening on ${port}`);
        });
    }

    public async start(): Promise<void> {
        if (this._initializationPromise) {
            await this._initializationPromise;
        }
        await this.banchoApi.login();
        this.startTime = Date.now();

        try {
            const response = (await this.vk.api.groups.getById({
                group_id: this.config.vk.groupId,
            })) as unknown as Array<{ id: number; name: string }>;
            const group = Array.isArray(response) ? response[0] : response;
            this.me = {
                id: -(group?.id ?? this.config.vk.groupId) || 0,
                name: group?.name ?? "osubot",
            };
        } catch (e) {
            global.logger.error("Failed to get group info:", e);
            this.me = { id: -this.config.vk.groupId, name: "osubot" };
        }

        if (this.useWebhooks) {
            this.ensureExpressAppCreated();
            try {
                await this.vk.updates.startWebhook({
                    path: process.env.WEBHOOK_ENDPOINT ?? "/",
                    port: Number(process.env.APP_PORT),
                });
            } catch (e) {
                global.logger.error("Failed to start webhook:", e);
            }
        } else {
            try {
                await this.vk.updates.startPolling();
                global.logger.info("Started polling for updates");
            } catch (e) {
                global.logger.error("Failed to start polling:", e);
            }
        }

        await this.database.statsModel.logStartup(this.me);
        await this.startStatsLogger();

        this.initHealthCheck();
        this.initPrometheusMetrics();
        this.listenExpressAppIfNeeded();

        global.logger.info(`Bot started as ${this.me.name} (group ${this.config.vk.groupId})`);
    }

    private async logStatsInfo() {
        global.logger.info("Logging stats");
        await this.database.statsModel.logUserCount();
        await this.database.statsModel.logChatCount();
        await this.database.statsModel.logBeatmapMetadataCacheCount();
        await this.database.statsModel.logBeatmapFilesCount();
        await global.logger.info("Stats logged");
    }

    private statsInterval: NodeJS.Timeout = undefined;
    private async startStatsLogger() {
        this.stopStatsLogger();
        await this.logStatsInfo();
        this.statsInterval = setInterval(
            () => {
                this.logStatsInfo();
            },
            15 * 60 * 1000
        );
    }
    private stopStatsLogger() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = undefined;
        }
    }

    public async stop(): Promise<void> {
        try {
            await this.vk.updates.stop();
        } catch {
            // ignore
        }
        clearInterval(this.statsInterval);
        global.logger.info("Bot stopped");
    }

    public addCallback(ctx: UnifiedMessageContext, callback: PendingCallback): string {
        const ticket = this.createCallbackTicket(ctx);
        this.pendingCallbacks[ticket] = callback;
        return ticket;
    }

    public removeCallback(ticket: string) {
        this.pendingCallbacks[ticket] = undefined;
    }

    private createCallbackTicket(ctx: UnifiedMessageContext): string {
        return `${ctx.senderId}_${ctx.chatId}`;
    }
}
