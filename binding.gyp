{
  "targets": [
    {
      "target_name": "sspdf",
      "sources": [ "src/sspdf.cc" ],
      "include_dirs" : [
          "<!(node -e \"require('nan')\")"
      ],
      "libraries": [
        "<!@(pkg-config --libs poppler-glib cairo)"
      ],
      "cflags": [
        "<!@(pkg-config --cflags poppler-glib cairo)"
      ]
    }
  ]
}
