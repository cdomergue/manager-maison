import { HttpContextToken } from '@angular/common/http';

// Marqueur pour indiquer que la requête ne doit pas déclencher le spinner global
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);
