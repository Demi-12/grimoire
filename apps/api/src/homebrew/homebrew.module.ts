import { Module } from "@nestjs/common";
import { HomebrewController } from "./homebrew.controller.js";
import { HomebrewService } from "./homebrew.service.js";

@Module({ controllers: [HomebrewController], providers: [HomebrewService], exports: [HomebrewService] })
export class HomebrewModule {}
