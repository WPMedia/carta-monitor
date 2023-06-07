import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";

export const getCartaServer = () =>
    new CartaServer(
        process.env.STAGE === "prod" ? Carta.Servers.PROD : Carta.Servers.TEST
    );
