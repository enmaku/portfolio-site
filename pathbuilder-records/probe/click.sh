#!/bin/bash
# click.sh <x> <y> [targetId]
T=${3:-EB0794557D8CBD3F66551E367C61603A}
curl -s -X POST http://127.0.0.1:9333/mouse -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"type\":\"mousePressed\",\"x\":$1,\"y\":$2,\"button\":\"left\",\"clickCount\":1}" >/dev/null
curl -s -X POST http://127.0.0.1:9333/mouse -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"type\":\"mouseReleased\",\"x\":$1,\"y\":$2,\"button\":\"left\",\"clickCount\":1}" >/dev/null
echo "clicked $1,$2"
