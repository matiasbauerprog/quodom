import { apiFetch } from './client';
import type { User, Direccion } from './types';

export const users = {
  signin: (body: { username: string; password: string }) =>
    apiFetch<User>('/users/signin', { method: 'POST', body }),
  signout: () =>
    apiFetch<{ res: boolean }>('/users/signout', { method: 'POST' }),
  signup: (body: { username: string; email: string; nombre: string; apellido?: string; password: string; codArea: string; telefono: string; dni?: string }) =>
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
  update: (body: Partial<Pick<User, 'username' | 'email' | 'nombre' | 'apellido' | 'dni' | 'codArea' | 'telefono'>> & { password?: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/', { method: 'PUT', body }),
  getDirecciones: () =>
    apiFetch<Direccion[]>('/users/dire/'),
  getDireccionDefault: () =>
    apiFetch<Direccion | null>('/users/direcciondefault/')
};
