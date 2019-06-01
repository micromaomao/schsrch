// Copied from https://github.com/micromaomao/schsrch/blob/7d849ed91b004ada494b33a606b81ce927417f89/lib/indexContent.js

module.exports = {
  tokenize: function (string) {
    if (!string) return []
    string = string.trim()
    let tokens = []
    for (let i = 0; i < string.length; i ++) {
      let c = string.charAt(i)
      if (/^[A-Za-z]$/.test(c)) {
        // Part of a word
        if (tokens.length === 0) {
          tokens.push(c)
        } else if (/^[A-Za-z]+$/.test(tokens[tokens.length - 1])) {
          // Last token is also part of a word
          // Append to last token
          tokens[tokens.length - 1] += c
        } else {
          tokens.push(c)
        }
      } else {
        if (/^\s$/.test(c) && tokens.length && /^\s+$/.test(tokens[tokens.length - 1])) {
          tokens[tokens.length - 1] = c
        } else {
          tokens.push(c)
        }
      }
    }
    return tokens
  },
  lcsRemoveSpace: function (a) {
    return a.filter(x => !(/^\s+$/.test(x)))
  },
  lcsLength: function (a, b) {
    // Don't consider space to save time.
    a = this.lcsRemoveSpace(a)
    b = this.lcsRemoveSpace(b)
    if (a.length < b.length) {
      return this.lcsLength(b, a)
    }
    // Assumption: a.length >= b.length

    // https://en.wikipedia.org/wiki/Longest_common_subsequence_problem#Computing_the_length_of_the_LCS
    /*
        a -->
      b -------
        |  |  |
      | -------
      | |  |  |
      v -------
        |  |  |
        -------
    */
    function mapIndex(a, b) {
      return b * 2 + a
    }
    let C = new Uint8Array(mapIndex(1, b.length) + 1)
    let i
    let j
    let k
    C[mapIndex(0, 0)] = 0
    C[mapIndex(1, 0)] = 0
    for (j = 0; j <= b.length; j ++) {
      C[mapIndex(0, j)] = 0
    }
    for (i = 1; i <= a.length; i ++) {
      for (j = 1; j <= b.length; j ++) {
        // Goes down, once reach end go back to top and move right.
        if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
          C[mapIndex(1, j)] = C[mapIndex(0, j-1)] + 1
        } else {
          C[mapIndex(1, j)] = Math.max(C[mapIndex(1, j-1)], C[mapIndex(0, j)])
        }
      }
      for (k = 0; k <= b.length; k ++) {
        C[mapIndex(0, k)] = C[mapIndex(1, k)]
      }
    }
    return C[mapIndex(1, b.length)]
  }
}
