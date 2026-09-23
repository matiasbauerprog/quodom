import type { components } from './schema';

type S = components['schemas'];

export type User = S['CurrentUser'] & Partial<Pick<S['SigninResponse'], 'role'>>;
export type Category = S['Category'];
// atributo1/atributo2 son el NOMBRE del grupo ("MEDIDAS"); los valores
// elegibles de cada uno vienen en valoresAtributoN.
export type Product = S['Product'];
export type ProductWithExiste = S['ProductWithExiste'];
export type Atributo = S['Atributo'];
export type Quodom = S['VQuodom'];
export type QuodomLine = S['VQuodomLine'];
export type Direccion = S['Direccion'];
export type Provincia = S['Provincia'];
export type Localidad = S['Localidad'];
export type Notificacion = S['Notificacion'];
export type BusquedaResult = S['BusquedaResult'];
