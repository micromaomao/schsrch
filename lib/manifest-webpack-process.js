function ManifestPlugin (options) {
}

ManifestPlugin.prototype.apply = function(compiler) {
  compiler.plugin('emit', function(compilation, callback) {
    var filelist = JSON.stringify(compilation.assets, ' ', 2)

    let jsonFile = Object.keys(compilation.assets).find(x => x.match(/\.json$/))
    console.log(compilation.assets[jsonFile])

    compilation.assets['filelist.json'] = {
      source: function() {
        return filelist
      },
      size: function() {
        return filelist.length
      }
    }

    callback()
  })
}

module.exports = ManifestPlugin
