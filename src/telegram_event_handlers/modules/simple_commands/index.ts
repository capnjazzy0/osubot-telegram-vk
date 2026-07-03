import { Module } from "../Module";
import { Bot } from "../../../Bot";
import { MapLink } from "./MapLink";
import { MapStats } from "./MapStats";
import { BanchoScore } from "./BanchoScore";
import { OsuReplay } from "./OsuReplay";
import { Roll } from "./Roll";
import { Weather } from "./Weather";
import { Lang } from "./Lang";
import { City } from "./City";

export class SimpleCommandsModule extends Module {
    constructor(bot: Bot) {
        super([], bot);

        this.name = "Simple";

        this.registerCommand([new MapLink(this), new MapStats(this), new BanchoScore(this), new OsuReplay(this), new Roll(this), new Weather(this), new Lang(this), new City(this)]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    checkPrefix(args: string[]): boolean {
        return true;
    }
}
