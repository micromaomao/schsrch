#include <nan.h>
#include <v8.h>
#include <poppler.h>
#include <cairo.h>
#include <cairo-svg.h>

namespace sspdf {

using v8::Local;
using v8::Value;
using v8::Function;
using v8::Exception;
using v8::Isolate;
using v8::Object;
using v8::Array;
using Nan::Callback;
using Nan::GetFunction;
using Nan::Set;
using Nan::Null;
using Nan::New;
using Nan::AsyncWorker;
using Nan::HandleScope;
using Nan::ThrowTypeError;
using Nan::Persistent;

const char* MSG_EXCEPTION_TOSTRING =  "Exception in filename.toString()";

class PdfssWorker : public AsyncWorker {
  public:
    v8::String::Utf8Value* uFileName = NULL;
    const char* fileName = NULL;
    double pw, ph;
    char* txt;
    PopplerRectangle* rects;
    guint rectLen;
    char* error = NULL;
    PdfssWorker(Callback* cb, Persistent<v8::String>* file)
      : AsyncWorker(cb) {
        Local<v8::String> hFileName = New<v8::String>(*file);
        this->uFileName = new v8::String::Utf8Value(hFileName);
        if (this->uFileName->length() == 0) {
          this->error = new char[strlen(MSG_EXCEPTION_TOSTRING)];
          strcpy(this->error, MSG_EXCEPTION_TOSTRING);
          delete this->uFileName;
          this->uFileName = NULL;
        } else {
          this->fileName = **this->uFileName;
        }
        file->Reset();
        delete file;
      }

    void Execute () {
      if (this->error != NULL) {
        return;
      }
      GError* gerror = NULL;
      PopplerDocument* pd = poppler_document_new_from_file(this->fileName, NULL, &gerror);
      if (pd == NULL) {
        this->error = new char[strlen(gerror->message)];
        strcpy(this->error, gerror->message);
        g_error_free(gerror);
        gerror = NULL;
        return;
      }
      PopplerPage* pg = poppler_document_get_page(pd, 0);
      poppler_page_get_size(pg, &this->pw, &this->ph);
      this->txt = poppler_page_get_text(pg);
      poppler_page_get_text_layout(pg, &this->rects, &this->rectLen);
    }

    void HandleOKCallback () {
      HandleScope scope;
      Local<Object> obj;
      Local<Array> rects;
      Local<Value> argv[] = {
        Null(), Null()
      };
      if (this->error == NULL) {
        obj = New<Object>();
        Set(obj, New<v8::String>("pw").ToLocalChecked(), New<v8::Number>(this->pw));
        Set(obj, New<v8::String>("ph").ToLocalChecked(), New<v8::Number>(this->ph));
        Set(obj, New<v8::String>("txt").ToLocalChecked(), New<v8::String>(this->txt).ToLocalChecked());
        rects = New<v8::Array>(this->rectLen);
        for (guint i = 0; i < this->rectLen; i ++) {
          Local<Object> xy = New<Object>();
          Set(xy, New<v8::String>("x1").ToLocalChecked(), New<v8::Number>(this->rects[i].x1));
          Set(xy, New<v8::String>("y1").ToLocalChecked(), New<v8::Number>(this->rects[i].y1));
          Set(xy, New<v8::String>("x2").ToLocalChecked(), New<v8::Number>(this->rects[i].x2));
          Set(xy, New<v8::String>("y2").ToLocalChecked(), New<v8::Number>(this->rects[i].y2));
          Set(rects, New<v8::Number>(i), xy);
        }
        Set(obj, New<v8::String>("rects").ToLocalChecked(), rects);
        g_free(this->rects);
        argv[1] = obj;
      } else {
        argv[0] = v8::Exception::Error(New<v8::String>(this->error).ToLocalChecked());
        delete this->error;
        this->error = NULL;
      }
      this->callback->Call(2, argv);
      if (this->uFileName != NULL) {
        delete this->uFileName;
        this->uFileName = NULL;
        this->fileName = NULL;
      }
    }
};

NAN_METHOD(hello) {
  if (info.Length() != 2) {
    ThrowTypeError("Two arguments.");
    return;
  }
  if (!info[0]->IsString()) {
    ThrowTypeError("arg[0] is not a string.");
    return;
  }
  if (!info[1]->IsFunction()) {
    ThrowTypeError("arg[1] is not a function.");
    return;
  }
  Callback *callback = new Callback(info[1].As<Function>());
  AsyncQueueWorker(new PdfssWorker(callback, new Persistent<v8::String>(info[0].As<v8::String>())));
}

NAN_MODULE_INIT(Init) {
  Set(target
    , New<v8::String>("hello").ToLocalChecked()
    , New<v8::FunctionTemplate>(hello)->GetFunction());
}

NODE_MODULE(sspdf, Init)

}
