import { Module } from "@nestjs/common";
import { CreaturesController } from "./creatures.controller.js";
import { CreaturesService } from "./creatures.service.js";

@Module({ controllers: [CreaturesController], providers: [CreaturesService], exports: [CreaturesService] })
export class CreaturesModule {}
