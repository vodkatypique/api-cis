#!/bin/bash
ip=$(hostname -I);
while sleep 5; do curl -X POST http://100.127.255.253:3001/ipUp -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5ld3RvbiIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjM3MDcxMDk5fQ.eEEmUsPK7HEEbYVY41drvxB6nZhN7k1nnNHnOkPVrXM" -H "Content-Type: application/json" -d "{\"ip\": \"$ip\"}"; done;#mettre l'ip de la machine