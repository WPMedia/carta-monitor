import { closeOpenAlert, createAlert } from "./opsGenie";
import { CartaAlerts } from "./alerts";

export const errorHandlerMiddleware = () => {
    return {
        onError: async (handler) => {
            // Create an alert to catch and alert on generic errors in carta-monitor
            await createAlert(CartaAlerts.Carta_Monitor_Error, handler.error);
            return {
                statusCode: 500,
                body: JSON.stringify("An error occurred"),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            };
        },
        after: async () => {
            await closeOpenAlert(CartaAlerts.Carta_Monitor_Error);
        }
    };
};
