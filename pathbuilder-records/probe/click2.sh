#!/bin/bash
T=EB0794557D8CBD3F66551E367C61603A
X=$1; Y=$2
curl -s -X POST http://127.0.0.1:9333/cmd -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mouseMoved\",\"x\":$X,\"y\":$Y,\"buttons\":0}}" >/dev/null
curl -s -X POST http://127.0.0.1:9333/cmd -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mousePressed\",\"x\":$X,\"y\":$Y,\"button\":\"left\",\"buttons\":1,\"clickCount\":1,\"pointerType\":\"mouse\"}}" >/dev/null
curl -s -X POST http://127.0.0.1:9333/cmd -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mouseReleased\",\"x\":$X,\"y\":$Y,\"button\":\"left\",\"buttons\":0,\"clickCount\":1,\"pointerType\":\"mouse\"}}" >/dev/null
echo "clicked $X,$Y"
