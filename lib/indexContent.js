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

    // https://en.wikipedia.org/wiki/Longest_common_subsequence_problem#Computing_the_length_of_the_LCS
    function mapIndex(i, j) {
      return i * (a.length + 1) + j
    }
    let C = new Array(mapIndex(a.length + 1, b.length + 1))
    let i
    let j
    for (i = 0; i <= a.length; i ++) {
      C[mapIndex(i, 0)] = 0
    }
    for (j = 0; j <= b.length; j ++) {
      C[mapIndex(0, j)] = 0
    }
    for (i = 1; i <= a.length; i ++) {
      for (j = 1; j <= b.length; j ++) {
        if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
          C[mapIndex(i, j)] = C[mapIndex(i-1, j-1)] + 1
        } else {
          C[mapIndex(i, j)] = Math.max(C[mapIndex(i, j-1)], C[mapIndex(i-1, j)])
        }
      }
    }
    return C[mapIndex(a.length, b.length)]
  }
}
