import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";
import { envVars } from "./environmentVariables";

export const getCartaServer = () =>
    new CartaServer(
        envVars.STAGE === "prod" ? Carta.Servers.PROD : Carta.Servers.TEST
    );
