import { Module } from "@nestjs/common";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { CharactersController } from "./characters.controller.js";
import { CharactersService } from "./characters.service.js";

@Module({ imports: [CampaignsModule], controllers: [CharactersController], providers: [CharactersService], exports: [CharactersService] })
export class CharactersModule {}
