#!/bin/bash
set -e

mongosh --quiet --eval '
db.getSiblingDB("resenas_db").createUser({
    user: "resenas_user",
    pwd: process.env.RESENAS_DB_PASSWORD,
    roles: [
        {
            role: "readWrite",
            db: "resenas_db"
        }
    ]
});
'