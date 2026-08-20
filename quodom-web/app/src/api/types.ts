export type User = {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido?: string;
  dni?: string;
  codArea?: string;
  telefono?: string;
  refreshFoto?: string | null;
  role?: string;
  token?: string;
};

export type Category = {
  id: number;
  nombrecategoria: string;
  idcategoriapadre: number;
  imagen: string | null;
  refreshImage: string | null;
  orden: number;
};

export type Product = {
  id: number;
  nombreproducto: string;
  descripcion?: string | null;
  categoria: number;
  categoriaPadre: number;
  imagen: string | null;
  refreshImagen: string | null;
  // atributo1/atributo2 son el NOMBRE del grupo ("MEDIDAS"); los valores
  // elegibles de cada uno vienen en valoresAtributoN.
  atributo1: string | null;
  atributo2: string | null;
  valoresAtributo1: string[];
  valoresAtributo2: string[];
};

export type ProductWithExiste = {
  id: number;
  nombreproducto: string;
  imagen: string | null;
  refreshImagen: string | null;
  existe: number;
};

export type Atributo = { valoratributo: string; orden: number; esvendedor: string };

export type Quodom = {
  id: string;
  descripcion: string;
  estado: 'CREADO' | 'ENVIADO';
  nro: string;
  createdBy: string;
  iddireccion: number | null;
  idrubro: number;
  nombrerubro?: string;
  cantproductos?: number;
  porccompletado?: number;
  fechaenvio?: string | null;
  createdAt?: string;
};

export type QuodomLine = {
  id: number;
  idquodom: string;
  idproducto: number;
  cantidad: number;
  nombreProducto: string;
  detalleProducto?: string | null;
  nombreCategoria?: string | null;
  categoria?: number;
  categoriaPadre?: number;
  atributo1?: string | null;
  atributo2?: string | null;
  nombreAtributo1?: string | null;
  nombreAtributo2?: string | null;
  imagen?: string | null;
  refreshImagen?: string | null;
  atributosFaltantes?: number;
};

export type Direccion = {
  id: number;
  userid: string;
  provincia: string | null;
  localidad: string | null;
  direccion: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  cp: string | null;
  alias: string | null;
  default: boolean | number;
  idprovincia: string | null;
  observaciones: string | null;
};

export type Provincia = { id: number; provincia: string };
export type Localidad = { id: number; localidad: string; idprovincia: number };

export type Notificacion = {
  id: number;
  titulo: string;
  texto: string;
  tiponotificacion: string;
  idquodom: string;
  createdAt: string;
  leida: number | boolean;
};

export type BusquedaResult = { id: number; nombre: string; descripcion?: string | null; imagen: string | null; refreshImagen: string | null; categoriaPadre: number };
