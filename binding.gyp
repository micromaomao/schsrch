{
  "targets": [
    {
      "target_name": "sspdf",
      "sources": [ "src/sspdf.cc" ],
      "include_dirs" : [
          "<!(node -e \"require('nan')\")"
      ]
    }
  ]
}
