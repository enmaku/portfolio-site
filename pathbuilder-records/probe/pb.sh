#!/bin/bash
# pb.sh '<js expression>'  -> evaluates in the Pathbuilder tab
TARGET=EB0794557D8CBD3F66551E367C61603A
curl -s -X POST http://127.0.0.1:9333/eval \
  -H 'content-type: application/json' \
  --data-binary @<(python3 -c "
import json,sys
expr=sys.stdin.read()
print(json.dumps({'targetId':'$TARGET','expression':expr}))
" <<< "$1")
