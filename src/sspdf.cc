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
using v8::Uint8Array;
using Nan::Callback;
using Nan::GetFunction;
using Nan::Set;
using Nan::Null;
using Nan::New;
using Nan::AsyncWorker;
using Nan::HandleScope;
using Nan::ThrowTypeError;
using Nan::Persistent;
using Nan::ObjectWrap;

const char* MSG_EXCEPTION_ZEROLEN =  "Zero length buffer provided.";

class PdfssWorker : public AsyncWorker {
  public:
    char* pdfData = NULL;
    Persistent<Uint8Array>* pdfBuffer = NULL;
    size_t pdfLen = 0;
    double pw, ph;
    char* txt;
    PopplerRectangle* rects;
    guint rectLen;
    char* error = NULL;
    int destPage;
    PdfssWorker(Callback* cb, Persistent<Uint8Array>* pdfBuffer, int destPage)
      : AsyncWorker(cb) {
      this->destPage = destPage;
      this->pdfBuffer = pdfBuffer;
      Local<Uint8Array> hPdf = New<Uint8Array>(*pdfBuffer);
      this->pdfLen = (*hPdf)->ByteLength();
      if (this->pdfLen == 0) {
        this->error = new char[strlen(MSG_EXCEPTION_ZEROLEN)];
        strcpy(this->error, MSG_EXCEPTION_ZEROLEN);
      } else {
        this->pdfData = (((char*)(*(*hPdf)->Buffer())->GetContents().Data())) + (*hPdf)->ByteOffset();
      }
    }

    void Execute () {
      if (this->error != NULL) {
        return;
      }
      GError* gerror = NULL;
      PopplerDocument* pd = poppler_document_new_from_data(this->pdfData, this->pdfLen, NULL, &gerror);
      if (pd == NULL) {
        this->error = new char[strlen(gerror->message)];
        strcpy(this->error, gerror->message);
        g_error_free(gerror);
        gerror = NULL;
        return;
      }
      PopplerPage* pg = poppler_document_get_page(pd, this->destPage);
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
      if (this->pdfBuffer != NULL) {
        this->pdfBuffer->Reset();
        delete this->pdfBuffer;
        this->pdfBuffer = NULL;
      }
    }
};

NAN_METHOD(getPage) {
  if (info.Length() != 3) {
    ThrowTypeError("getPage(pdfBuffer, pageNum, callback)");
    return;
  }
  if (!info[0]->IsUint8Array()) {
    ThrowTypeError("arg[0] is not a buffer.");
    return;
  }
  if (!info[1]->IsInt32()) {
    ThrowTypeError("arg[1] is not a int32.");
    return;
  }
  if (!info[2]->IsFunction()) {
    ThrowTypeError("arg[2] is not a function.");
    return;
  }
  int pn = (int)(*info[1].As<v8::Number>())->Value();
  if (pn < 0) {
    ThrowTypeError("arg[1] shouldn't be < 0.");
    return;
  }
  Callback *callback = new Callback(info[2].As<Function>());
  AsyncQueueWorker(new PdfssWorker(callback, new Persistent<Uint8Array>(info[0].As<Uint8Array>()), pn));
}

NAN_MODULE_INIT(Init) {
  Set(target
    , New<v8::String>("getPage").ToLocalChecked()
    , New<v8::FunctionTemplate>(getPage)->GetFunction());
}

NODE_MODULE(sspdf, Init)

}
