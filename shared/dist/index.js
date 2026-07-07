"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTileUnplayable = exports.CORPORATIONS = exports.fillCorporation = exports.getAdjacentCells = exports.getStockPrice = exports.chooseMergeSurvivor = exports.resolveMergeStocks = exports.getPlayerFinancials = exports.calculateNetWorth = exports.endTurn = exports.buyStock = exports.foundCorporation = exports.playTile = exports.startGame = exports.addPlayer = exports.createInitialTiles = exports.createInitialGameState = void 0;
__exportStar(require("./bots/Bot"), exports);
__exportStar(require("./bots/HeuristicBot"), exports);
__exportStar(require("./bots/RandomBot"), exports);
var engine_1 = require("./engine");
Object.defineProperty(exports, "createInitialGameState", { enumerable: true, get: function () { return engine_1.createInitialGameState; } });
Object.defineProperty(exports, "createInitialTiles", { enumerable: true, get: function () { return engine_1.createInitialTiles; } });
Object.defineProperty(exports, "addPlayer", { enumerable: true, get: function () { return engine_1.addPlayer; } });
Object.defineProperty(exports, "startGame", { enumerable: true, get: function () { return engine_1.startGame; } });
Object.defineProperty(exports, "playTile", { enumerable: true, get: function () { return engine_1.playTile; } });
Object.defineProperty(exports, "foundCorporation", { enumerable: true, get: function () { return engine_1.foundCorporation; } });
Object.defineProperty(exports, "buyStock", { enumerable: true, get: function () { return engine_1.buyStock; } });
Object.defineProperty(exports, "endTurn", { enumerable: true, get: function () { return engine_1.endTurn; } });
Object.defineProperty(exports, "calculateNetWorth", { enumerable: true, get: function () { return engine_1.calculateNetWorth; } });
Object.defineProperty(exports, "getPlayerFinancials", { enumerable: true, get: function () { return engine_1.getPlayerFinancials; } });
Object.defineProperty(exports, "resolveMergeStocks", { enumerable: true, get: function () { return engine_1.resolveMergeStocks; } });
Object.defineProperty(exports, "chooseMergeSurvivor", { enumerable: true, get: function () { return engine_1.chooseMergeSurvivor; } });
Object.defineProperty(exports, "getStockPrice", { enumerable: true, get: function () { return engine_1.getStockPrice; } });
Object.defineProperty(exports, "getAdjacentCells", { enumerable: true, get: function () { return engine_1.getAdjacentCells; } });
Object.defineProperty(exports, "fillCorporation", { enumerable: true, get: function () { return engine_1.fillCorporation; } });
Object.defineProperty(exports, "CORPORATIONS", { enumerable: true, get: function () { return engine_1.CORPORATIONS; } });
Object.defineProperty(exports, "isTileUnplayable", { enumerable: true, get: function () { return engine_1.isTileUnplayable; } });
