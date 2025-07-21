import { world } from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

const log = Logger.getLogger("Dinoscript");

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    log.info("Placed", event.block.typeId);
});
