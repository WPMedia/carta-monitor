import { closeOpenAlert, createAlert } from "./opsGenie";
import { CartaAlerts } from "./alerts";

export const errorHandlerMiddleware = () => {
    return {
        onError: async (handler) => {
            // Create an alert to catch and alert on generic errors in carta-monitor
            await createAlert(
                CartaAlerts.Unknown_Carta_Monitor_Error,
                `Error from ${handler?.context?.logGroupName ?? "ERROR"}: ${
                    handler?.error?.message ?? "No error provided"
                }`
            );
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
            await closeOpenAlert(CartaAlerts.Unknown_Carta_Monitor_Error);
        }
    };
};
