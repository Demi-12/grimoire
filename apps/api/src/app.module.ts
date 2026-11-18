import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module.js";
import { BackupModule } from "./backup/backup.module.js";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { CharactersModule } from "./characters/characters.module.js";
import { CreaturesModule } from "./creatures/creatures.module.js";
import { HomebrewModule } from "./homebrew/homebrew.module.js";
import { InvitesModule } from "./invites/invites.module.js";
import { MapModule } from "./map/map.module.js";
import { MeModule } from "./me/me.module.js";
import { MonstersModule } from "./monsters/monsters.module.js";
import { SpellsModule } from "./spells/spells.module.js";
import { TelemetryModule } from "./telemetry/telemetry.module.js";

/** One module per API domain; each owns its controller(s) and service(s). See CLAUDE.md for the map. */
@Module({
  imports: [
    MeModule, CharactersModule, CampaignsModule, InvitesModule, MapModule, CreaturesModule, HomebrewModule,
    MonstersModule, SpellsModule, BackupModule, TelemetryModule, AdminModule,
  ],
})
export class AppModule {}
