import { Module } from "@nestjs/common";
import { HomebrewModule } from "../homebrew/homebrew.module.js";
import { MonstersController } from "./monsters.controller.js";
import { MonstersService } from "./monsters.service.js";

@Module({ imports: [HomebrewModule], controllers: [MonstersController], providers: [MonstersService], exports: [MonstersService] })
export class MonstersModule {}
