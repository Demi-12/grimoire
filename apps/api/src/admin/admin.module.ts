import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({ controllers: [AdminController], providers: [AdminService, AnalyticsService] })
export class AdminModule {}
