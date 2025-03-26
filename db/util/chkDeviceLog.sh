#!/bin/bash

# Check if a deviceId parameter is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <deviceId>"
    exit 1
fi

DEVICE_ID=$1

mongosh --quiet --eval<<EOF
use iotsrv
db.log.aggregate([ 
    {   \$match: { 
            timestamp: { \$gte: new Date().getTime() - 5 * 60 * 60 * 1000 }, /* Last  hours*/ 
            deviceId: "$DEVICE_ID" 
        } 
    }, 
    {   \$project: { 
            _id: 0, 
            t: { \$dateToString: { format: "%Y-%m-%d %H:%M:%S", date: { \$toDate: "\$timestamp" } } },
            l: { \$substr: ["\$logMsg", { \$subtract: [{ \$strLenBytes: "\$logMsg" }, 25] }, 25] } 
        } 
    }, 
    { \$limit: 100 }
] );

EOF