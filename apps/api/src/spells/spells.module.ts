import { Module } from "@nestjs/common";
import { SpellsController } from "./spells.controller.js";
import { SpellsService } from "./spells.service.js";

@Module({ controllers: [SpellsController], providers: [SpellsService] })
export class SpellsModule {}
