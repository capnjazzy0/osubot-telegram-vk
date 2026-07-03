import { MessageContext, MessageEventContext, Keyboard as VKKeyboard, VK } from "vk-io";
import { FluentBundle, FluentResource } from "@fluent/bundle";
import fs from "fs/promises";
import path from "path";
import { ILocalisator, TranslateFunction, TranslationVariables } from "./ILocalisator";
import { UserSettings } from "./data/Models/Settings/UserSettingsModel";
import { ChatSettings } from "./data/Models/Settings/ChatSettingsModel";
import { Language } from "./data/Models/Settings/SettingsTypes";
import Database from "./data/Database";
import { ControllableFeature } from "./data/Models/FeatureControlModel";
import { IKeyboard } from "./Util";
import Util from "./Util";
import axios from "axios";

type VkContext = MessageContext | MessageEventContext;

interface IVideoMeta {
    url: string;
    width: number;
    height: number;
    duration: number;
}

export interface SendOptions {
    keyboard?: IKeyboard;
    photo?: string | Buffer;
    video?: IVideoMeta;
    dont_parse_links?: boolean;
}

class ReplyToMessage {
    readonly text: string;
    readonly senderId: number;
    readonly chatId: number;

    constructor(ctx: MessageContext) {
        const reply = ctx.replyMessage;
        this.text = reply?.text ?? "";
        this.senderId = reply?.senderId;
        this.chatId = reply?.peerId;
    }
}

const registry = new FinalizationRegistry(async (p: string) => {
    if (!(await Util.fileExists(p))) {
        return;
    }
    global.logger.warn(`Removing file ${p} after destructing object`);
    try {
        await fs.rm(p);
    } catch {
        global.logger.fatal(`Failed to remove file: ${p}`);
    }
});

class I18nProvider {
    private readonly bundles: Map<string, FluentBundle> = new Map();
    private readonly defaultLocale: string;
    private loaded: boolean = false;

    constructor(defaultLocale: string) {
        this.defaultLocale = defaultLocale;
    }

    async load(directory: string) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const localeDir = path.join(directory, entry.name);
            const files = await fs.readdir(localeDir);
            const bundle = new FluentBundle(entry.name, { useIsolating: false });
            for (const file of files) {
                if (!file.endsWith(".ftl")) continue;
                const content = await fs.readFile(path.join(localeDir, file), "utf-8");
                const resource = new FluentResource(content);
                bundle.addResource(resource);
            }
            this.bundles.set(entry.name, bundle);
        }
        this.loaded = true;
    }

    translate(key: string, vars?: Record<string, unknown>, locale?: string): string {
        const l = locale ?? this.defaultLocale;
        const bundle = this.bundles.get(l);
        if (!bundle) return key;
        const msg = bundle.getMessage(key);
        if (!msg) return key;
        const errors: Error[] = [];
        const result = bundle.formatPattern(msg.value, vars, errors);
        if (errors.length > 0) {
            global.logger.warn(`Translation error for '${key}': ${errors.map((e) => e.message).join(", ")}`);
        }
        return result;
    }
}

const i18nProvider = new I18nProvider("en");

export async function initI18n(directory: string) {
    await i18nProvider.load(directory);
}

function isMessageEventContext(ctx: VkContext): ctx is MessageEventContext {
    return "eventPayload" in (ctx as Record<string, unknown>);
}

export default class UnifiedMessageContext implements ILocalisator {
    readonly chatId: number;
    readonly senderId: number;

    readonly plainText?: string;
    readonly plainPayload?: string;

    readonly replyMessage?: ReplyToMessage;

    readonly isInGroupChat: boolean;

    private readonly vk: VK;
    private readonly message: MessageContext | undefined;
    private readonly messageEvent: MessageEventContext | undefined;
    private readonly me: { id: number };
    private readonly database: Database;

    private tmpFile?: string;
    private registryToken?: object;

    private userSettingsCache: UserSettings;
    private chatSettingsCache: ChatSettings;

    private isLocalisatorActivated: boolean = false;
    private language: Language = undefined;
    internalTranslate: TranslateFunction = undefined;

    tr(key: string, vars?: TranslationVariables) {
        if (this.isLocalisatorActivated) {
            return this.internalTranslate(key, vars);
        }

        return `Error: Translation context is not activated. Please, report this to developer. Translation key: '${key}'.`;
    }

    private readonly ownerId: number;
    get isFromOwner(): boolean {
        return this.senderId == this.ownerId;
    }

    private graphicalModeOverride: "no" | "cards" | "plain" = "no";

    private convertReplyMessage(ctx: MessageContext): ReplyToMessage {
        if (!ctx.replyMessage) {
            return undefined;
        }

        return new ReplyToMessage(ctx);
    }

    constructor(ctx: VkContext, ownerId: number, me: { id: number }, vk: VK, database: Database) {
        this.vk = vk;
        this.me = me;
        this.database = database;
        this.ownerId = ownerId;

        if (isMessageEventContext(ctx)) {
            const evt = ctx as MessageEventContext;
            this.messageEvent = evt;
            this.message = undefined;
            const rawPayload = evt.eventPayload;
            let parsedPayload: { d?: string } | undefined;
            if (typeof rawPayload === "string") {
                try { parsedPayload = JSON.parse(rawPayload); } catch { parsedPayload = undefined; }
            } else {
                parsedPayload = rawPayload as { d?: string } | undefined;
            }
            this.plainPayload = parsedPayload?.d ?? undefined;
            this.plainText = undefined;
            this.senderId = evt.userId;
            this.chatId = evt.peerId;
            this.replyMessage = undefined;
        } else {
            const msg = ctx as MessageContext;
            this.message = msg;
            this.messageEvent = undefined;
            this.plainText = msg.text ?? undefined;
            this.plainPayload = msg.messagePayload ? String(msg.messagePayload) : undefined;
            this.replyMessage = this.convertReplyMessage(msg);
            this.senderId = msg.senderId;
            this.chatId = msg.peerId;
        }

        this.isInGroupChat = ctx.peerId > 2000000000;

        this.parsePayload();
    }

    private overridenText: string = undefined;
    get text(): string {
        return this.overridenText ?? this.plainText;
    }

    private overridenPayload: string = undefined;
    get messagePayload(): string {
        return this.overridenPayload ?? this.plainPayload;
    }

    applyTextOverrides(aliases: Record<string, string>) {
        const text = this.text;
        if (!text) {
            return;
        }
        const lowerText = text.toLowerCase();
        for (const [alias, command] of Object.entries(aliases)) {
            const lowerOverride = alias.toLowerCase();

            if (lowerText.startsWith(lowerOverride)) {
                if (text.length === alias.length || /^\s$/.test(text.charAt(alias.length))) {
                    this.overridenText = (command + " " + text.slice(alias.length).trim()).trim();
                    return;
                }
            }
        }
    }

    private parsePayload() {
        if (!this.plainPayload?.startsWith("^")) {
            return;
        }

        const payloadSplit = this.plainPayload.slice(1).split("^");
        if (payloadSplit.length < 2) {
            this.overridenPayload = payloadSplit[0];
            return;
        }

        const payload = [];
        let argsEnded = false;
        for (const string of payloadSplit) {
            if (!argsEnded) {
                if (string.startsWith("g") && string.length == 2) {
                    const mode = Number(string.slice(1));
                    if (mode == 1) {
                        this.graphicalModeOverride = "plain";
                    } else if (mode == 2) {
                        this.graphicalModeOverride = "cards";
                    }
                } else {
                    argsEnded = true;
                }
            }

            if (argsEnded) {
                payload.push(string);
            }
        }

        this.overridenPayload = payload.join("^");
    }

    private async prepareButtonPayloadPrefix(): Promise<string> {
        const ctxData = [];
        if (await this.preferCardsOutput()) {
            ctxData.push("g2");
        } else {
            ctxData.push("g1");
        }

        return "^" + ctxData.join("^") + "^";
    }

    private async createKeyboard(rows: IKeyboard): Promise<ReturnType<typeof VKKeyboard.keyboard> | undefined> {
        if (!rows || rows.length == 0) {
            return undefined;
        }

        const payloadPrefix = await this.prepareButtonPayloadPrefix();

        const buttonRows = rows.map((row) =>
            row.map((button) =>
                VKKeyboard.callbackButton({
                    label: button.text,
                    payload: JSON.stringify({ d: payloadPrefix + button.command }),
                })
            )
        );
        return VKKeyboard.keyboard(buttonRows).inline();
    }

    private userInfoUpdated: boolean = false;
    async ensureUserInfoUpdated() {
        if (this.userInfoUpdated) {
            return;
        }

        if (this.senderId > 0) {
            try {
                const [user] = (await this.vk.api.users.get({
                    user_ids: [this.senderId],
                })) as Array<{ id: number; screen_name?: string; first_name: string; last_name: string }>;
                if (user) {
                    await this.database.userInfo.set({
                        user_id: this.senderId,
                        display_username: user.screen_name ?? null,
                        first_name: user.first_name ?? null,
                        last_name: user.last_name ?? null,
                    });
                }
            } catch {
                // ignore
            }
        }

        this.userInfoUpdated = true;
    }

    async activateLocalisator() {
        if (this.isLocalisatorActivated) {
            return;
        }

        if (this.isInGroupChat) {
            const chatSettings = await this.chatSettings();
            if (chatSettings.language_override != "do_not_override") {
                this.language = chatSettings.language_override;
            }
        }

        if (!this.language) {
            const userSettings = await this.userSettings();
            if (userSettings.language_override != "do_not_override") {
                this.language = userSettings.language_override;
            }
        }

        this.internalTranslate = (key: string, vars?: TranslationVariables) => {
            return i18nProvider.translate(key, vars as Record<string, unknown>, this.language ?? undefined);
        };
        this.isLocalisatorActivated = true;
    }

    async reactivateLocalisator() {
        this.isLocalisatorActivated = false;
        this.language = undefined;
        await this.activateLocalisator();
    }

    public async checkFeature(feature: ControllableFeature) {
        if (this.isFromOwner) {
            const allFeatures = await this.database.featureControlModel.isFeatureEnabled("admin-all-features");
            if (allFeatures) {
                return true;
            }
        }

        return await this.database.featureControlModel.isFeatureEnabled(feature);
    }

    async preferCardsOutput(): Promise<boolean> {
        const cardsEnabled = await this.checkFeature("oki-cards");
        if (!cardsEnabled) {
            return false;
        }

        if (this.graphicalModeOverride != "no") {
            return this.graphicalModeOverride == "cards";
        }

        const settings = await this.userSettings();
        return settings.content_output == "oki-cards";
    }

    async userSettings(forceUpdate: boolean = false): Promise<UserSettings> {
        if (forceUpdate || !this.userSettingsCache) {
            this.userSettingsCache = await this.database.userSettings.getUserSettings(this.senderId);
        }

        return this.userSettingsCache;
    }

    async chatSettings(forceUpdate: boolean = false): Promise<ChatSettings> {
        if (!this.isInGroupChat) {
            return undefined;
        }

        if (forceUpdate || !this.chatSettingsCache) {
            this.chatSettingsCache = await this.database.chatSettings.getChatSettings(this.chatId);
        }

        return this.chatSettingsCache;
    }

    async updateUserSettings(settings: UserSettings) {
        if (settings.user_id != this.senderId) {
            return;
        }
        await this.database.userSettings.updateSettings(settings);
        this.userSettingsCache = settings;
    }

    async updateChatSettings(settings: ChatSettings) {
        if (!this.isInGroupChat || settings.chat_id != this.chatId) {
            return;
        }
        await this.database.chatSettings.updateSettings(settings);
        this.chatSettingsCache = settings;
    }

    async reply(text: string, options?: SendOptions) {
        return await this.send(text, options);
    }

    async send(text: string, options?: SendOptions, replyTo?: number) {
        try {
            const keyboard = await this.createKeyboard(options?.keyboard);
            let attachment: string | undefined;

            if (options?.photo) {
                try {
                    const source = typeof options.photo === "string"
                        ? { value: options.photo }
                        : { value: options.photo };
                    const uploaded = await this.vk.upload.messagePhoto({
                        source,
                        peer_id: this.chatId,
                    });
                    attachment = uploaded.toString();
                } catch (e) {
                    global.logger.error("Failed to upload photo:", e);
                }
            }

            if (options?.video && !attachment) {
                text = `${text}\n${options.video.url}`;
            }

            const params: Record<string, unknown> = {
                peer_id: this.chatId,
                message: text,
                random_id: Date.now(),
                dont_parse_links: options?.dont_parse_links ? 1 : 0,
            };

            if (keyboard) {
                params.keyboard = keyboard;
            }
            if (attachment) {
                params.attachment = attachment;
            }
            if (replyTo) {
                params.reply_to = replyTo;
            }

            return await this.vk.api.messages.send(params);
        } catch (e) {
            global.logger.error(e);
            return undefined;
        }
    }

    async remove() {
        if (!this.messagePayload && !this.message) {
            return undefined;
        }
        try {
            const messageId = this.message?.id ?? this.messageEvent?.conversationMessageId;
            if (messageId) {
                await this.vk.api.messages.delete({
                    message_ids: [messageId],
                    delete_for_all: 1,
                });
            }
        } catch (e) {
            global.logger.error(e);
            return undefined;
        }
    }

    async edit(text: string, options?: SendOptions): Promise<void> {
        if (!this.messagePayload) {
            return;
        }

        const keyboard = await this.createKeyboard(options?.keyboard);
        let attachment: string | undefined;

        if (options?.photo) {
            try {
                const source = typeof options.photo === "string"
                    ? { value: options.photo }
                    : { value: options.photo };
                const uploaded = await this.vk.upload.messagePhoto({
                    source,
                    peer_id: this.chatId,
                });
                attachment = uploaded.toString();
            } catch (e) {
                global.logger.error("Failed to upload photo:", e);
            }
        }

        try {
            await this.vk.api.messages.edit({
                peer_id: this.chatId,
                message: text,
                conversation_message_id: this.messageEvent?.conversationMessageId ?? this.message?.conversationMessageId ?? 0,
                ...(keyboard ? { keyboard } : {}),
                ...(attachment ? { attachment } : {}),
            });
        } catch (e) {
            global.logger.error(e);
        }
    }

    async editMarkup(keyboard: IKeyboard, text?: string) {
        if (!this.messagePayload) {
            return undefined;
        }
        const kb = await this.createKeyboard(keyboard);
        if (!kb) {
            return undefined;
        }
        try {
            return await this.vk.api.messages.edit({
                peer_id: this.chatId,
                message: text ?? "",
                conversation_message_id: this.messageEvent?.conversationMessageId ?? this.message?.conversationMessageId ?? 0,
                keyboard: kb,
            });
        } catch (e) {
            global.logger.error(e);
            return undefined;
        }
    }

    async answer(text: string): Promise<true> {
        if (!this.messageEvent) {
            return;
        }
        try {
            await this.messageEvent.answer({
                type: "show_snackbar",
                text: text ?? "",
            });
            return true;
        } catch {
            return;
        }
    }

    async isUserAdmin(userId: number): Promise<boolean> {
        try {
            const members = (await this.vk.api.messages.getConversationMembers({
                peer_id: this.chatId,
            })) as { items?: Array<{ member_id: number; is_admin?: boolean }> };
            const member = members.items?.find((m) => m.member_id === userId);
            return member?.is_admin ?? false;
        } catch {
            return false;
        }
    }

    async isSenderAdmin(): Promise<boolean> {
        return this.isUserAdmin(this.senderId);
    }

    async isBotAdmin(): Promise<boolean> {
        return this.isUserAdmin(this.me.id);
    }

    async isUserInChat(userId: number, chatId?: number): Promise<boolean> {
        try {
            const peerId = chatId ?? this.chatId;
            const members = (await this.vk.api.messages.getConversationMembers({
                peer_id: peerId,
            })) as { items?: Array<{ member_id: number }> };
            return members.items?.some((m) => m.member_id === userId) ?? false;
        } catch {
            return false;
        }
    }

    async isChatValid(chatId: number): Promise<boolean> {
        try {
            await this.vk.api.messages.getConversationMembers({
                peer_id: chatId,
            });
            return true;
        } catch {
            return false;
        }
    }

    async isBotInChat(chatId: number): Promise<boolean> {
        return this.isUserInChat(this.me.id, chatId);
    }

    async chatMembersCount(): Promise<number> {
        try {
            const members = (await this.vk.api.messages.getConversationMembers({
                peer_id: this.chatId,
            })) as { count?: number };
            return members.count ?? 0;
        } catch {
            return 0;
        }
    }

    hasLinks(): boolean {
        return /https?:\/\/[^\s]+/.test(this.plainText ?? "");
    }

    getLinks(): Array<{ url: string }> {
        const links: Array<{ url: string }> = [];
        const regex = /https?:\/\/[^\s]+/g;
        let match;
        while ((match = regex.exec(this.plainText ?? "")) !== null) {
            links.push({ url: match[0] });
        }
        return links;
    }

    hasFile(): boolean {
        return this.message?.attachments?.some((a) => a.type === "doc") ?? false;
    }

    getFileName(): string {
        const doc = this.message?.attachments?.find((a) => a.type === "doc") as { doc?: { title?: string } } | undefined;
        return doc?.doc?.title ?? "";
    }

    getFileSize(): number {
        const doc = this.message?.attachments?.find((a) => a.type === "doc") as { doc?: { size?: number } } | undefined;
        return doc?.doc?.size ?? Number.MAX_VALUE;
    }

    registerTempFile(filePath: string) {
        if (!this.registryToken) {
            this.registryToken = {};
        }
        registry.register(this.registryToken, filePath);
    }

    async downloadFile(): Promise<string> {
        if (this.tmpFile) {
            return this.tmpFile;
        }

        const doc = this.message?.attachments?.find((a) => a.type === "doc") as { doc?: { url?: string; title?: string } } | undefined;
        if (!doc?.doc?.url) {
            throw new Error("No document to download");
        }

        const response = await axios.get(doc.doc.url, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);
        const ext = path.extname(doc.doc.title ?? ".tmp") || ".tmp";
        const tmpPath = path.join(
            process.env.TEMP || "/tmp",
            `vk_download_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
        );
        await fs.writeFile(tmpPath, buffer);

        this.tmpFile = tmpPath;
        this.registerTempFile(this.tmpFile);
        return this.tmpFile;
    }

    async removeFile(): Promise<void> {
        if (!this.tmpFile) {
            return;
        }
        try {
            if (await Util.fileExists(this.tmpFile)) {
                await fs.rm(this.tmpFile);
            }
            if (this.registryToken) {
                registry.unregister(this.registryToken);
                this.registryToken = undefined;
            }
            this.tmpFile = undefined;
        } catch {
            global.logger.fatal(`Failed to remove file: ${this.tmpFile}`);
        }
    }
}
