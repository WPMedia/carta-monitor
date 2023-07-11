import { envVars } from "./environmentVariables";
import { sendFilters } from "./mongo";

export enum Priority {
    P0 = "P0",
    P1 = "P1",
    P2 = "P2",
    P3 = "P3"
}

export const enum CartaAlerts {
    // Schedule alerts
    // These alerts check if there have been any 'send' events in the past 15 and 30 minutes for different types of sends.
    // If no activity is detected, an alert is triggered.
    // How to test: no effect way to test,
    // instead, if this does not work, the error will show itself via the "Delay" alerts,
    // because if we are not sending letters regularly,
    // those alerts will fire
    Schedule_Transactional_Send = "Schedule_Transactional_Send",
    Schedule_Personalized_Send = "Schedule_Personalized_Send",
    Schedule_Nonpersonalized_Send = "Schedule_Nonpersonalized_Send",
    Alert_Send = "Alert_Send",

    // No sends alerts
    // These alerts check if there have been no 'send' events in the past X and X + Y minutes for different types of sends.
    // If no sends are detected, an alert is triggered.
    // How to test: reduce SEND_DELAY_P2_MINUTES and SEND_DELAY_P1_MINUTES to really low numbers
    Transactional_Send_Delay = "Transactional_Send_Delay",
    Personalized_Send_Delay = "Personalized_Send_Delay",
    NonPersonalized_Send_Delay = "NonPersonalized_Send_Delay",
    // How to test: make ALERT_EMAIL_LIST an invalid list
    Alert_Send_Delay = "Alert_Send_Delay",

    // Metrics alerts
    // These alerts check if the volume of documents in the 'events' collection exceeds a threshold.
    // How to test: reduce METRICS_EVENTS_COUNT_ALERT_THRESHHOLD .env to something very low, then trigger metrics events to process
    Metrics_Processing_Above_Threshshold = "Metrics_Processing_Above_Threshshold", // Events collection is backed up

    // File download alerts
    // These alerts check for delayed processing of file downloads.
    // How to test: reduce FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES to a lower threshhold, then trigger a large file download
    File_Download_Processing_Delay = "File_Download_Processing_Delay", // File download processing is delayed more than 15 mins

    // Dynamic list alerts
    // These alerts check for processing delays in dynamic lists.
    // How to test: TODO -- ask Jesse
    Automatic_Dynamic_List = "Automatic_Dynamic_List", // Auto-running dynamic list(s) failed to run
    Scheduled_Dynamic_List = "Scheduled_Dynamic_List", // Scheduled dynamic list(s) failed to run

    // Campaign send alerts
    // These alerts monitor the status of newsletter campaigns and update their send state.
    // They also trigger alerts and escalate the alert level based on the campaign status.
    // How to test: reduce threshhold for send to be considered delay via SENDS_PER_ALLOWED_TIME_SEGMENT, MINUTES_PER_ALLOWED_TIME_SEGMENT, and SUCCESSFUL_SEND_COMPLETION_PERCENTAGE
    Multiple_Campaign_Send_Delay = "Multiple_Campaign_Send_Delay", // Email send of multiple campaigns is delayed.

    // Carta-sender
    // How to test: pass an invalid email, like "12345", to the CARTA_SENDER_EMAIL variable
    Carta_Sender = "Carta_Sender",

    // Unknown issue with monitor
    // How to test: Any unhandled error
    Unknown_Carta_Monitor_Error = "Unknown_Carta_Monitor_Error"
}

interface AlertDetails {
    priority: Priority;
    message: string;
    description?: string;
}

const createSendDelayMessage = (
    alertType: string,
    campaignIdOrName: string
) => {
    return {
        priority: Priority.P2,
        message: `Viewers have not received ${alertType} emails in the last ${envVars.SEND_DELAY_P2_MINUTES} minutes`,
        description: `
        1. Check ${alertType} Campaign: ${campaignIdOrName}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters[alertType.toLowerCase()]
        )}, sorted by statusDoneTimestamp
        
        Note: Will escalate to P1 after ${
            envVars.SEND_DELAY_P1_MINUTES
        } minutes`
    };
};

export const alertDetails: { [K in CartaAlerts]: AlertDetails } = {
    [CartaAlerts.Schedule_Transactional_Send]: {
        priority: Priority.P2,
        message: "Failed to schedule a transactional send"
    },
    [CartaAlerts.Schedule_Personalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a personalized send"
    },
    [CartaAlerts.Schedule_Nonpersonalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a nonpersonalized send"
    },
    [CartaAlerts.Alert_Send]: {
        priority: Priority.P1,
        message: "Failed to send an alert send"
    },
    [CartaAlerts.Transactional_Send_Delay]: createSendDelayMessage(
        "Transactional",
        envVars.TRANSACTIONAL_CAMPAIGN_ID
    ),
    [CartaAlerts.Personalized_Send_Delay]: createSendDelayMessage(
        "Personalized",
        envVars.PERSONALIZED_CAMPAIGN_ID
    ),
    [CartaAlerts.NonPersonalized_Send_Delay]: createSendDelayMessage(
        "Nonpersonalized",
        envVars.NONPERSONALIZED_CAMPAIGN_ID
    ),
    [CartaAlerts.Alert_Send_Delay]: createSendDelayMessage(
        "Alert",
        envVars.ALERT_CAMPAIGN_NAME
    ),
    [CartaAlerts.Metrics_Processing_Above_Threshshold]: {
        priority: Priority.P2,
        message: "Events collection is backed up",
        description: `More than ${+envVars.METRICS_EVENTS_COUNT_ALERT_THRESHHOLD} entries detected in "events" collection. Check if the metrics processor is running and progressing through entries.`
    },
    [CartaAlerts.File_Download_Processing_Delay]: {
        priority: Priority.P2,
        message: "File download processing is delayed more than 15 mins"
    },
    [CartaAlerts.Scheduled_Dynamic_List]: {
        priority: Priority.P2,
        message: "Scheduled dynamic list(s) failed to run"
    },
    [CartaAlerts.Automatic_Dynamic_List]: {
        priority: Priority.P2,
        message: "Auto-running dynamic list(s) failed to run"
    },
    [CartaAlerts.Multiple_Campaign_Send_Delay]: {
        priority: Priority.P1,
        message: "Email send of multiple campaigns is delayed.",
        description: `If this happens, there are two likely culprits:
1. A serious error in the email queuing/sending that causes all send attempts to fail
2. An error in multiple letters/campaigns that causes the send to fail to at least 10% of users on at least two sends
To see if 1 is the case, try a couple test sends. If they fail, look for errors in Splunk.
        
If test sends work, the issue is likely a bad template/config on at least two campaigns (#2 above). Go to the Carta Status page and find out which sends have not sent to the expected number of users. If the delivery metrics are reasonably up to date, you can identify these by finding campaigns with a “Delivery rate” under 90% (if the send success rate is 80%, the delivery rate will be less than that, so this would be a quick way to find likely culprits).
        
Then, search Splunk logs for errors relating to these sends. In the past, the issue has been some users do not have variables referenced in templates, causing those sends to fail.`
    },
    [CartaAlerts.Carta_Sender]: {
        priority: Priority.P1,
        message: "Carta-sender returning failed response"
    },
    [CartaAlerts.Unknown_Carta_Monitor_Error]: {
        priority: Priority.P3,
        message: "Carta-monitor threw an unexpected error"
    }
};
