#!/bin/bash
while true; do variable=$(nc -l -p 1605);(sleep 5; echo ${variable^^}; sleep 15; curl -X POST http://100.127.255.253:3001/retour -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5ld3RvbiIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjM3MDcxMDk5fQ.eEEmUsPK7HEEbYVY41drvxB6nZhN7k1nnNHnOkPVrXM" -H "Content-Type: application/json" -d "{\"hash1\":\"hashClair1\", \"hash2\": \"Hashclair2\"}";) & done