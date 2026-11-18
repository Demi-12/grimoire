import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";
import { EncountersController } from "./encounters.controller.js";
import { EncountersService } from "./encounters.service.js";

@Module({
  controllers: [CampaignsController, EncountersController],
  providers: [CampaignsService, EncountersService],
  exports: [CampaignsService, EncountersService],
})
export class CampaignsModule {}
