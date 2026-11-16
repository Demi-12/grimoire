import { Module } from "@nestjs/common";
import { MeModule } from "./me/me.module.js";

/** One module per API domain; each owns its controller(s). See CLAUDE.md for the map. */
@Module({
  imports: [MeModule],
})
export class AppModule {}
