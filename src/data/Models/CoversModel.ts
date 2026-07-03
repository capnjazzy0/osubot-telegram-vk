import { VK } from "vk-io";
import Database from "../Database";
import axios from "axios";

interface Cover {
    id: number;
    attachment: string;
}

interface Image {
    url: string;
    attachment: string;
}

export class CoversModel {
    private readonly db: Database;
    private readonly vk: VK;
    private readonly owner: number;

    constructor(db: Database, vk: VK, owner: number) {
        this.db = db;
        this.vk = vk;
        this.owner = owner;
    }

    async addCover(id: number): Promise<string> {
        try {
            const response = await axios.get(`https://assets.ppy.sh/beatmaps/${id}/covers/cover@2x.jpg`, {
                responseType: "arraybuffer",
            });
            const buffer = Buffer.from(response.data);

            const uploaded = await this.vk.upload.messagePhoto({
                source: { value: buffer },
                peer_id: this.owner,
            });
            const attachment = uploaded.toString();

            await this.db.run("INSERT INTO covers (id, attachment) VALUES ($1, $2)", [id, attachment]);

            return attachment;
        } catch {
            return "";
        }
    }

    async getCover(id: number): Promise<string> {
        const cover = await this.db.get<Cover>("SELECT * FROM covers WHERE id = $1", [id]);
        if (!cover) {
            return this.addCover(id);
        }
        return cover.attachment;
    }

    async addPhotoDoc(photoUrl: string): Promise<string> {
        try {
            const response = await axios.get(photoUrl, {
                responseType: "arraybuffer",
            });
            const buffer = Buffer.from(response.data);

            const uploaded = await this.vk.upload.messagePhoto({
                source: { value: buffer },
                peer_id: this.owner,
            });
            const attachment = uploaded.toString();

            await this.db.run("INSERT INTO photos (url, attachment) VALUES ($1, $2)", [photoUrl, attachment]);

            return attachment;
        } catch {
            return "";
        }
    }

    async getPhotoDoc(photoUrl: string): Promise<string> {
        const cover = await this.db.get<Image>("SELECT * FROM photos WHERE url = $1", [photoUrl]);
        if (!cover) {
            return this.addPhotoDoc(photoUrl);
        }
        return cover.attachment;
    }

    async removeEmpty() {
        await this.db.run("DELETE FROM covers WHERE attachment = $1", [""]);
        await this.db.run("DELETE FROM photos WHERE attachment = $1", [""]);
    }
}
