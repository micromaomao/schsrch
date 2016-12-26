#include <nan.h>
#include <v8.h>

namespace sspdf {

using v8::Local;
using v8::Value;
using v8::Function;
using v8::Exception;
using v8::Isolate;
using v8::Object;
using Nan::Callback;
using Nan::GetFunction;
using Nan::Set;
using Nan::Null;
using Nan::New;
using Nan::AsyncWorker;
using Nan::HandleScope;
using Nan::ThrowTypeError;
using Nan::Persistent;

class PdfssWorker : public AsyncWorker {
  public:
    Persistent<v8::String>* fileName;
    const char* result;
    PdfssWorker(Callback* cb, Persistent<v8::String>* file)
      : AsyncWorker(cb) {
        this->fileName = file;
      }

    void Execute () {
    }

    void HandleOKCallback () {
      HandleScope scope;
      Isolate* isolate = v8::Isolate::GetCurrent();
      Local<Object> obj = Object::New(isolate);
      Set(obj, New<v8::String>("world").ToLocalChecked(), New<v8::String>(*this->fileName));
      Local<Value> argv[] = {
        obj
      };
      this->callback->Call(1, argv);
      this->fileName->Reset();
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
