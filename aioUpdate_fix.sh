#!/bin/bash

mongosh <<EOF
use iotsrv
db.values.updateMany(
    { "aioResponse.response.error": { \$regex: "future" } },
    { \$unset: { aioStatus: "" } }
);
EOF