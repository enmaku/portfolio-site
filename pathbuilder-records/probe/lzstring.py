# LZ-string decompressFromBase64 (standard algorithm, matches lz-string JS)
keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
baseReverseDic = {}

def _getBaseValue(alphabet, character):
    if alphabet not in baseReverseDic:
        baseReverseDic[alphabet] = {c: i for i, c in enumerate(alphabet)}
    return baseReverseDic[alphabet].get(character, 0)

def _decompress(length, resetValue, getNextValue):
    dictionary = {}
    enlargeIn = 4
    dictSize = 4
    numBits = 3
    entry = ""
    result = []
    data = {"val": getNextValue(0), "position": resetValue, "index": 1}

    def readBits(n):
        bits = 0
        maxpower = 1 << n
        power = 1
        while power != maxpower:
            resb = data["val"] & data["position"]
            data["position"] >>= 1
            if data["position"] == 0:
                data["position"] = resetValue
                data["val"] = getNextValue(data["index"])
                data["index"] += 1
            bits |= (1 if resb > 0 else 0) * power
            power <<= 1
        return bits

    next_ = readBits(2)
    if next_ == 0:
        c = chr(readBits(8))
    elif next_ == 1:
        c = chr(readBits(16))
    elif next_ == 2:
        return ""
    dictionary[3] = c
    w = c
    result.append(c)
    while True:
        if data["index"] > length:
            return ""
        cc = readBits(numBits)
        if cc == 0:
            dictionary[dictSize] = chr(readBits(8))
            cc = dictSize
            dictSize += 1
        elif cc == 1:
            dictionary[dictSize] = chr(readBits(16))
            cc = dictSize
            dictSize += 1
        elif cc == 2:
            return "".join(result)
        if enlargeIn == 0:
            enlargeIn = 1 << numBits
            numBits += 1
        if cc in dictionary:
            entry = dictionary[cc]
        else:
            if cc == dictSize:
                entry = w + w[0]
            else:
                return None
        result.append(entry)
        dictionary[dictSize] = w + entry[0]
        dictSize += 1
        enlargeIn -= 1
        w = entry
        if enlargeIn == 0:
            enlargeIn = 1 << numBits
            numBits += 1

def decompress_from_base64(compressed):
    if compressed is None or compressed == "":
        return None
    return _decompress(len(compressed), 32, lambda index: _getBaseValue(keyStrBase64, compressed[index]))
