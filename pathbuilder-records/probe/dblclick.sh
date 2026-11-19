#!/bin/bash
T=EB0794557D8CBD3F66551E367C61603A
X=$1; Y=$2
for n in 1 2; do
curl -s -X POST http://127.0.0.1:9333/cmd -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mousePressed\",\"x\":$X,\"y\":$Y,\"button\":\"left\",\"buttons\":1,\"clickCount\":$n,\"pointerType\":\"mouse\"}}" >/dev/null
curl -s -X POST http://127.0.0.1:9333/cmd -H 'content-type: application/json' -d "{\"targetId\":\"$T\",\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mouseReleased\",\"x\":$X,\"y\":$Y,\"button\":\"left\",\"buttons\":0,\"clickCount\":$n,\"pointerType\":\"mouse\"}}" >/dev/null
sleep 0.05
done
echo "dblclicked $X,$Y"
