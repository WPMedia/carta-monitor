# Architectural Overview

The purpose of this file is to provide knowledge transfer of the new carta-monitor app.

## Background

The purpose of this application is to monitor our services and fire OpsGenie alerts when appropriate. The application has the secondary function of marking send statuses as done/warning/alert in campaignSendAlerts (seems out-of-scope of monitoring, but I carried over the logic from the old CartaMonitor).

## Technologies

This application is a Serverless Lambda application, which invokes functions defined in the serverless.yml at scheduled intervals. The application pulls credentials from AWS SSM, reads data from our MongoDB servers, and fires alerts via the OpsGenie API. Separetly, Datadog monitors the invocations of the lambda functions, and fires an alert to OpsGenie if no data is found, or no invocations are being made.

## A Rewrite

This app is a rewrite of a previous CartaMonitor application, found [here](https://github.com/WPMedia/wp-email/tree/5c26c6067ef300bb239e2914e61c039e1a003efd/CartaMonitor). Improvements:

-   Serverless. Serverless architecture is more appropriate for a monitoring app because individual monitoring functions are A) naturally stateless and B) run at scheduled intervals far apart (10-15 minutes). With these constraints, serverless is more manageable and cheaper than a traditional server. In fact, carta-monitor invocations fall under the [AWS Lambda Free Tier](https://aws.amazon.com/lambda/pricing/), which is one million requests per month at time of writing, whereas carta-monitor invokes in the order of magnitude of 10,000 requests per month.
-   Moved to AWS Refresh. Moving to Refresh is a [long-term Carta goal](https://arcpublishing.atlassian.net/wiki/spaces/CAR/pages/3124625884/App+migration+to+AWS+refresh), making deployments easier and less error-prone.
-   Reduced complexity. The previous app tracked alerts in MongoDB as well as Datadog, two unnecessary intermediaries. We can fire alerts directly in carta-monitor without storing data in MongoDB or Datadog. Note: we still use Datadog to confirm our monitors are running, look at README.md for details.

## How To Use

To invoke functions locally, refer to the README.md "Local Development" section.

To invoke functions on the server, refer to the [Test Event](https://docs.aws.amazon.com/lambda/latest/dg/testing-functions.html) functionality. To simulate alerts, refer to the `alerts.ts` file and the "How to test" comments above each alert. To change threshholds locally, modify the `.env` file (Note: Alerts will not fire )

## Contributors

Jack Nugent did the majority of the rewrite. On 7/18/23, I demoed the application to the following:

-   Jesse Post
-   Daniel Thompson
-   Kevin Rux
-   Nader Heidari

WIP -- CONTINUE WORKING ON
