import {inject} from '@angular/core';
import {HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {finalize, Observable} from 'rxjs';
import {LoadingService} from '../services/loading.service';
import {SKIP_GLOBAL_LOADING} from '../http/http-context.tokens';

export const loadingInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const loadingService = inject(LoadingService);

  const shouldSkip = req.context.get(SKIP_GLOBAL_LOADING);
  if (!shouldSkip) {
    loadingService.startRequest();
  }

  return next(req).pipe(
    finalize(() => {
      if (!shouldSkip) {
        loadingService.endRequest();
      }
    })
  );
};


