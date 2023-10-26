#include <nan.h>
#include <v8.h>
#include <poppler.h>
#include <cairo.h>
#include <cairo-svg.h>
#include <vector>

namespace sspdf {

using v8::Local;
using v8::Value;
using v8::Function;
using v8::Exception;
using v8::Isolate;
using v8::Object;
using v8::Array;
using v8::Uint8Array;
using v8::ArrayBuffer;
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
using std::vector;

const char* MSG_EXCEPTION_ZEROLEN = "Zero length buffer provided.";
const char* MSG_EXCEPTION_PAGE_FAIL = "Unable to open that page.";
const char* MSG_EXCEPTION_PAGE_OUT_OF_RANGE = "Page index out of range.";
const char* MSG_EXCEPTION_CARIO_ERROR = "Error creating cario surface.";

class PdfssWorker : public AsyncWorker {
  // DEPRECATION PLANNED
  public:
    char* pdfData = NULL;
    size_t pdfLen = 0;
    double pw, ph;
    char* txt;
    PopplerRectangle* rects;
    guint rectLen;
    char* error = NULL; // Error stored here from {constructor, Execute} freed in HandleOKCallback.
    int destPage;
    int pageNum = 0;
    vector<char> svgData;
    // pdf data copied.
    PdfssWorker(Callback* cb, Local<Uint8Array> hPdf, int destPage)
      : AsyncWorker(cb) {
      this->destPage = destPage;
      this->pdfLen = (*hPdf)->ByteLength();
      if (this->pdfLen == 0) {
        this->error = new char[strlen(MSG_EXCEPTION_ZEROLEN) + 1];
        strcpy(this->error, MSG_EXCEPTION_ZEROLEN);
      } else {
        char* pdfData = (((char*)(*(*hPdf)->Buffer())->GetBackingStore()->Data())) + (*hPdf)->ByteOffset();
        this->pdfData = new char[this->pdfLen];
        memcpy(this->pdfData, pdfData, this->pdfLen);
      }
    }

    void Execute () {
      if (this->error != NULL) {
        return;
      }
      GError* gerror = NULL;
      PopplerDocument* popperDoc = poppler_document_new_from_data(this->pdfData, this->pdfLen, NULL, &gerror);
      if (popperDoc == NULL) {
        this->error = new char[strlen(gerror->message) + 1];
        strcpy(this->error, gerror->message);
        g_error_free(gerror);
        gerror = NULL;
        return;
      }
      int nPages = poppler_document_get_n_pages(popperDoc);
      this->pageNum = nPages;
      if (this->destPage >= nPages) {
        this->error = new char[strlen(MSG_EXCEPTION_PAGE_OUT_OF_RANGE) + 1];
        strcpy(this->error, MSG_EXCEPTION_PAGE_OUT_OF_RANGE);
        g_object_unref(popperDoc);
        return;
      }
      PopplerPage* page = poppler_document_get_page(popperDoc, this->destPage);
      g_object_unref(popperDoc);
      popperDoc = NULL;
      if (page == NULL) {
        this->error = new char[strlen(MSG_EXCEPTION_PAGE_FAIL) + 1];
        strcpy(this->error, MSG_EXCEPTION_PAGE_FAIL);
        return;
      }
      poppler_page_get_size(page, &this->pw, &this->ph);
      this->txt = poppler_page_get_text(page);
      poppler_page_get_text_layout(page, &this->rects, &this->rectLen);
      // this->rects require freeing by us, freed on HandleOKCallback.

      cairo_surface_t* svgSurface = cairo_svg_surface_create_for_stream((cairo_write_func_t) PdfssWorker::writeFunc, this, this->pw, this->ph);
      if (cairo_surface_status(svgSurface) != CAIRO_STATUS_SUCCESS) {
        this->error = new char[strlen(MSG_EXCEPTION_CARIO_ERROR) + 1];
        strcpy(this->error, MSG_EXCEPTION_CARIO_ERROR);
        cairo_surface_destroy(svgSurface);
        return;
      }
      cairo_t* svg = cairo_create(svgSurface);
      if (cairo_status(svg) != CAIRO_STATUS_SUCCESS) {
        this->error = new char[strlen(MSG_EXCEPTION_CARIO_ERROR) + 1];
        strcpy(this->error, MSG_EXCEPTION_CARIO_ERROR);
        cairo_surface_destroy(svgSurface);
        cairo_destroy(svg);
        return;
      }
      poppler_page_render(page, svg);
      cairo_surface_destroy(svgSurface);
      cairo_destroy(svg);
      g_object_unref(page);
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
        Set(obj, New<v8::String>("width").ToLocalChecked(), New<v8::Number>(this->pw));
        Set(obj, New<v8::String>("height").ToLocalChecked(), New<v8::Number>(this->ph));
        Set(obj, New<v8::String>("text").ToLocalChecked(), New<v8::String>(this->txt).ToLocalChecked());
        Set(obj, New<v8::String>("pageNum").ToLocalChecked(), New<v8::Number>(this->pageNum));
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
        if (this->rectLen) g_free(this->rects);
        if (this->txt) g_free(this->txt);
        argv[1] = obj;

        if (this->svgData.size() > 0) {
          auto ml = node::Buffer::Copy(Isolate::GetCurrent(), &(*this->svgData.begin()), this->svgData.size());
          if (ml.IsEmpty()) {
            argv[0] = v8::Exception::Error(New<v8::String>("Can't return svg data.").ToLocalChecked());
          } else {
            Set(obj, New<v8::String>("svg").ToLocalChecked(), ml.ToLocalChecked());
          }
        } else {
          Set(obj, New<v8::String>("svg").ToLocalChecked(), Null());
        }
      } else {
        argv[0] = v8::Exception::Error(New<v8::String>(this->error).ToLocalChecked());
        delete this->error;
        this->error = NULL;
      }
      this->callback->Call(2, argv);
      if (this->pdfData != NULL) {
        delete this->pdfData;
        this->pdfData = NULL;
      }
    }
    static cairo_status_t writeFunc (void* closure, const unsigned char* data, unsigned int length) {
      PdfssWorker* worker = (PdfssWorker*) closure;
      worker->svgData.reserve(worker->svgData.size() + length);
      for (unsigned int i = 0; i < length; i ++) {
        worker->svgData.push_back(data[i]);
      }
      return CAIRO_STATUS_SUCCESS;
    }
};

class pdfContentAllWorker : public AsyncWorker {
  public:
    char* pdfData = NULL;
    size_t pdfLen = 0;
    double pw, ph;
    char** pageTexts = NULL;
    PopplerRectangle** pageRects = NULL;
    guint* pageRectLens = NULL;
    char* error = NULL; // Error stored here from {constructor, Execute} freed in HandleOKCallback.
    int numPages = 0;
    // pdf data copied.
    pdfContentAllWorker(Callback* cb, Local<Uint8Array> hPdf)
      : AsyncWorker(cb) {
      this->pdfLen = (*hPdf)->ByteLength();
      if (this->pdfLen == 0) {
        this->error = new char[strlen(MSG_EXCEPTION_ZEROLEN) + 1];
        strcpy(this->error, MSG_EXCEPTION_ZEROLEN);
      } else {
        char* pdfData = ((char*) (*(*hPdf)->Buffer())->GetBackingStore()->Data()) + (*hPdf)->ByteOffset();
        this->pdfData = new char[this->pdfLen];
        memcpy(this->pdfData, pdfData, this->pdfLen);
      }
    }

    void Execute () {
      if (this->error != NULL) {
        return;
      }
      GError* gerror = NULL;
      PopplerDocument* popperDoc = poppler_document_new_from_data(this->pdfData, this->pdfLen, NULL, &gerror);
      if (popperDoc == NULL) {
        this->error = new char[strlen(gerror->message) + 1];
        strcpy(this->error, gerror->message);
        g_error_free(gerror);
        gerror = NULL;
        return;
      }
      int nPages = poppler_document_get_n_pages(popperDoc);
      this->numPages = nPages;

      this->pageRects = new PopplerRectangle*[nPages];
      this->pageTexts = new char*[nPages];
      this->pageRectLens = new guint[nPages];
      for (int p = 0; p < nPages; p ++) {
        PopplerPage* page = poppler_document_get_page(popperDoc, p);
        if (page == NULL) {
          this->error = new char[strlen(MSG_EXCEPTION_PAGE_FAIL) + 1];
          strcpy(this->error, MSG_EXCEPTION_PAGE_FAIL);
          g_object_unref(popperDoc);
          return;
        }

        poppler_page_get_size(page, &this->pw, &this->ph);
        // this->pageTexts[p] = poppler_page_get_text(page);
        auto pageText = poppler_page_get_text(page);
        this->pageTexts[p] = new char[strlen(pageText) + 1];
        strcpy(this->pageTexts[p], pageText);
        g_free(pageText);
        pageText = NULL;
        poppler_page_get_text_layout(page, this->pageRects + p, this->pageRectLens + p);

        g_object_unref(page);
      }
      g_object_unref(popperDoc);
      popperDoc = NULL;
    }

    void HandleOKCallback () {
      HandleScope scope;
      Local<Object> returnObj = New<Object>();
      Local<Array> pageRects = New<Array>();
      Local<Array> pageTexts = New<Array>();
      Local<Value> argv[] = {
        Null(), Null()
      };
      if (this->error == NULL) {
        auto strLastWidth = New<v8::String>("lastWidth").ToLocalChecked();
        auto strLastHeight = New<v8::String>("lastHeight").ToLocalChecked();
        auto strNumPages = New<v8::String>("numPages").ToLocalChecked();
        auto strPageTexts = New<v8::String>("pageTexts").ToLocalChecked();
        auto strPageRects = New<v8::String>("pageRects").ToLocalChecked();
        auto strX1 = New<v8::String>("x1").ToLocalChecked();
        auto strX2 = New<v8::String>("x2").ToLocalChecked();
        auto strY1 = New<v8::String>("y1").ToLocalChecked();
        auto strY2 = New<v8::String>("y2").ToLocalChecked();
        Set(returnObj, strLastWidth, New<v8::Number>(this->pw));
        Set(returnObj, strLastHeight, New<v8::Number>(this->ph));
        Set(returnObj, strNumPages, New<v8::Number>(this->numPages));
        for (int p = 0; p < this->numPages; p ++) {
          auto pn = New<v8::Number>(p);
          Set(pageTexts, pn, New<v8::String>(this->pageTexts[p]).ToLocalChecked());
          delete this->pageTexts[p];
          this->pageTexts[p] = NULL;
          auto rects = New<Array>();
          auto cRects = this->pageRects[p];
          auto cRectlen = this->pageRectLens[p];
          for (guint i = 0; i < cRectlen; i ++) {
            Local<Object> rectObj = New<Object>();
            auto cRect = cRects[i];
            Set(rectObj, strX1, New<v8::Number>(cRect.x1));
            Set(rectObj, strX2, New<v8::Number>(cRect.x2));
            Set(rectObj, strY1, New<v8::Number>(cRect.y1));
            Set(rectObj, strY2, New<v8::Number>(cRect.y2));
            Set(rects, New<v8::Number>(i), rectObj);
          }
          Set(pageRects, New<v8::Number>(p), rects);
          if (cRectlen) g_free(cRects);
          this->pageRects[p] = NULL;
        }
        Set(returnObj, strPageTexts, pageTexts);
        Set(returnObj, strPageRects, pageRects);
        argv[1] = returnObj;
      } else {
        argv[0] = v8::Exception::Error(New<v8::String>(this->error).ToLocalChecked());
        delete this->error;
        this->error = NULL;
      }
      this->callback->Call(2, argv);
      if (this->pageRects) {
        delete this->pageRects;
      }
      if (this->pageTexts) {
        delete this->pageTexts;
      }
      if (this->pageRectLens) {
        delete this->pageRectLens;
      }
      if (this->pdfData != NULL) {
        delete this->pdfData;
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
  auto pdfBuffer = info[0].As<Uint8Array>();
  if (pdfBuffer.IsEmpty()) {
    ThrowTypeError("arg[0] can't resolve.");
    return;
  }
  Callback *callback = new Callback(info[2].As<Function>());
  AsyncQueueWorker(new PdfssWorker(callback, pdfBuffer, pn));
}

NAN_METHOD(getPDFContentAll) {
  if (info.Length() != 2) {
    ThrowTypeError("getPage(pdfBuffer, callback)");
    return;
  }
  if (!info[0]->IsUint8Array()) {
    ThrowTypeError("arg[0] is not a buffer.");
    return;
  }
  if (!info[1]->IsFunction()) {
    ThrowTypeError("arg[1] is not a function.");
    return;
  }
  auto pdfBuffer = info[0].As<Uint8Array>();
  if (pdfBuffer.IsEmpty()) {
    ThrowTypeError("arg[0] can't resolve.");
    return;
  }
  Callback *callback = new Callback(info[1].As<Function>());
  AsyncQueueWorker(new pdfContentAllWorker(callback, pdfBuffer));
}

NAN_MODULE_INIT(Init) {
  auto context = Isolate::GetCurrent()->GetCurrentContext();
  Set(target
    , New<v8::String>("getPage").ToLocalChecked()
    , New<v8::FunctionTemplate>(getPage)->GetFunction(context).ToLocalChecked());
  Set(target
    , New<v8::String>("getPDFContentAll").ToLocalChecked()
    , New<v8::FunctionTemplate>(getPDFContentAll)->GetFunction(context).ToLocalChecked());
}

NODE_MODULE(sspdf, Init)

}
