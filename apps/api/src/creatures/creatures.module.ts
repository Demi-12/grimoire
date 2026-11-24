import { Module } from "@nestjs/common";
import { HomebrewModule } from "../homebrew/homebrew.module.js";
import { MonstersModule } from "../monsters/monsters.module.js";
import { CreaturesController } from "./creatures.controller.js";
import { CreaturesService } from "./creatures.service.js";

@Module({ imports: [HomebrewModule, MonstersModule], controllers: [CreaturesController], providers: [CreaturesService], exports: [CreaturesService] })
export class CreaturesModule {}
