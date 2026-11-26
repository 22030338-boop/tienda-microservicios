#!/bin/bash
set -e

mongosh --quiet --eval '
db.getSiblingDB("resenas_db").createUser({
    user: "resenas_user",
    pwd: "SECRET_RESENAS",
    roles: [
        {
            role: "readWrite",
            db: "resenas_db"
        }
    ]
});
'
