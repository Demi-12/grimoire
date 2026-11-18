import { Module } from "@nestjs/common";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { CharactersModule } from "../characters/characters.module.js";
import { CreaturesModule } from "../creatures/creatures.module.js";
import { BackupController } from "./backup.controller.js";
import { BackupService } from "./backup.service.js";

@Module({ imports: [CampaignsModule, CharactersModule, CreaturesModule], controllers: [BackupController], providers: [BackupService] })
export class BackupModule {}
