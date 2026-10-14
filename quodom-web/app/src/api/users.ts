import { apiFetch } from './client';
import type { User, Direccion } from './types';

export const users = {
  signin: (body: { username: string; password: string }) =>
    apiFetch<User>('/users/signin', { method: 'POST', body }),
  signout: () =>
    apiFetch<{ res: boolean }>('/users/signout', { method: 'POST' }),
  // Sin `username` ni `codArea`: el alta ya no los pide (se entra con el mail y
  // el código de área es fijo). El contrato los descarta si igual se mandan.
  signup: (body: { email: string; nombre: string; apellido?: string; password: string; telefono: string }) =>
    apiFetch<{ res: boolean; id?: string; message: string }>('/users/signup', { method: 'POST', body }),
  reset: (body: { email: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/reset', { method: 'POST', body }),
  reenviar: (body: { email: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/reenviar', { method: 'POST', body }),
  changePass: (body: { password: string; token: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/changePass', { method: 'POST', body }),
  validateEmail: (token: string) =>
    apiFetch<{ res: boolean; message: string }>('/users/validateEmail/' + encodeURIComponent(token)),
  validateReset: (token: string) =>
    apiFetch<{ res: boolean; message?: string }>('/users/validateReset/' + encodeURIComponent(token)),
  current: () =>
    apiFetch<User>('/users/current'),
  update: (body: Partial<Pick<User, 'email' | 'nombre' | 'apellido' | 'telefono' | 'empresa' | 'cuit' | 'facturaA'>> & { password?: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/', { method: 'PUT', body }),
  getDirecciones: () =>
    apiFetch<Direccion[]>('/users/dire/'),
  getDireccionDefault: () =>
    apiFetch<Direccion | null>('/users/direcciondefault/')
};
