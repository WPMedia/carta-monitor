import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";
import { environmentVariables } from "./environmentVariables";

export const getCartaServer = () =>
    new CartaServer(
        environmentVariables.STAGE === "prod"
            ? Carta.Servers.PROD
            : Carta.Servers.TEST
    );
