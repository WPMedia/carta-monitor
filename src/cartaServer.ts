import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";
import { getEnvCache } from "./environmentVariables";

export const getCartaServer = () =>
    new CartaServer(
        getEnvCache().STAGE === "prod" ? Carta.Servers.PROD : Carta.Servers.TEST
    );
