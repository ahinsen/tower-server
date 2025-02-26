#!/bin/bash

# filepath: /home/iot-server/tower-server/test/test_post.sh

# Define the URL to which the POST request will be sent
URL="http://localhost:8002"

# Get the JSON file path from the first argument
JSON_FILE="$1"

# Check if the JSON file path is provided
if [ -z "$JSON_FILE" ]; then
    echo "Usage: $0 <path_to_json_file>"
    exit 1
fi

# Send the POST request and capture the response
response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d @"$JSON_FILE" "$URL")

# Extract the response body and response code
response_body=$(echo "$response" | sed '$d')
response_code=$(echo "$response" | tail -n1)

# Display the response code and response body
echo "Response Code: $response_code"
echo "Response Body: $response_body"