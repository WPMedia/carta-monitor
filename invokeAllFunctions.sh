#!/bin/bash
# This script invokes all serverless functions locally.
# It exits with a failure if any of the functions throw an exception.

# Load environment variables
. ./.envrc

# Declare an array with the names of the services to invoke
declare -a services=(
    "sendScheduling"
    # "sender" will add back when todo is done on this function
    "testAlert"
    "metricsProcessing"
    "fileDownloadProcessing"
    "dynamicListProcessing"
    "campaignSendAlerts"
    "send"
)

# Inform the user about the operation that will be performed
echo "Invoking serverless functions locally. This script will exit with a failure if any function throws an exception."

# Loop over the services and invoke each one
for service in "${services[@]}"; do
    # Echo to the console which service is being invoked for clearer logging
    echo "Invoking $service"
    if ! serverless invoke local --function "$service"; then
        # If the service fails to invoke, echo a failure message and exit the script with a status code of 1
        echo "Invocation of $service failed" >&2
        exit 1
    fi
done

# Echo a success message if all functions are invoked successfully
echo "All functions invoked successfully"
exit 0
